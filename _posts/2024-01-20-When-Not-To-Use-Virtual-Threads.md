---
title: "When not to use virtual threads in Java"
seo_enabled: true
excerpt_text: "We'll take a look at how platform and virtual threads are scheduled, demonstrate the consequences of using the wrong type of thread, and outline"
excerpt_image: /assets/images/posts/2024-01-When-Not-To-Use-Virtual-Threads/vt_vs_pt_meme-edit-s.webp
categories: [Programming]
tags: [Java, Virtual threads, Concurrency]
---

We'll take a look at how platform and virtual threads are scheduled, demonstrate the consequences of using the wrong type of thread, and outline the differences between them.

  
## Scheduling of platform threads

Platform threads are scheduled by the operating system. Active threads are distributed among CPU cores. When more threads arrive, CPU time is shared among unblocked threads; each thread is given a “time slice”. After the time is up, a kernel triggers an interrupt signal, which suspends the current thread and assigns the CPU to the next one. This behavior is transparent to the programmer (preemptive).

{%- include image.html url="/assets/images/posts/2024-01-When-Not-To-Use-Virtual-Threads/platform_thread_scheduling.png" description="Scheduling of platform threads under heavy load.<br>Note the even distribution of CPU time among the threads" -%}

This way, more active threads than CPU cores runs concurrently, and the execution of the scheduled threads starts without much delay.

This also enables the control of thread priority by allocating more CPU time to certain threads.

Service application threads often experience significant blocking while waiting for responses from other service calls or database operations, leading to inefficient thread usage.

{%- include image.html url="/assets/images/posts/2024-01-When-Not-To-Use-Virtual-Threads/platform_thread_sleep.png" description="Platform thread idling on a blocking operation" -%}

When no threads are available, the application will come to a halt, despite CPU usage being low.    


## Scheduling of virtual threads

Virtual threads are queued tasks. Unlike platform threads, their scheduling and queueing is managed by the JVM (ForkJoinPool).

{%- include image.html url="/assets/images/posts/2024-01-When-Not-To-Use-Virtual-Threads/vt_scheduling2.png" description="Scheduling of virtual threads" -%}

Here we see T1 is used as a carrier thread (a platform thread in schedulers pool for executing virtual threads), running virtual threads VT2 and VT3, while waiting for VT1 to get unblocked. Note the uneven scheduling periods of the threads.

1. Virtual thread VT1 is taken from the queue, and mounted onto one of the available platform threads (carrier thread) of the scheduler. VT1 gets executed, then it is blocked by making an external service call.
2. VT1 gets unmounted; its stack is saved to the heap and its status is set to 'parked' (blocked) and put in the schedulers queue.
3. Scheduler takes the virtual thread VT2 from the queue, runs using T1. After VT2 is finished, it does the same for VT3. 
4. Response from the external service is received, VT1 can be scheduled. What actually happens is that operating system notifies the JVM about unblocked I/O resource. The message is forwarded to the scheduler, which removes the blocked status of VT1 ('parked' -> 'runnable'). But VT1 cannot be scheduled right away, because no carrier thread is available at the moment.
5. When VT3 is finished, carrier thread T1 becomes available. VT1 gets scheduled to run on T1. 


## The culprit: Delayed execution with CPU intensive operations

The scheduler does not have a control over when a virtual thread will be scheduled or how much CPU time it will get. Scheduling only occurs when a running virtual thread gets blocked or finished. Therefore, the waiting time for the virtual threads in the queue can be long and unpredictable.

To demonstrate this easily, we will allow JVM to use two CPU cores, with JVM argument `XX:ActiveProcessorCount=2`.

We start two virtual threads with CPU heavy operations, and a third one doing less work:

```java

// CPU intensive method, not tested for correct functionality
static List<Long> findPrimeNumbers(long from, long to) {
    System.out.println(Thread.currentThread().getName() + " started");
    if (to < from || to < 3)
        return Collections.emptyList();
    List<Long> list = LongStream.rangeClosed(from < 3 ? 3 : from, to)
             .filter(i -> LongStream.range(2, i)
                                    .noneMatch(j -> i % j == 0))
             .boxed()
             .toList();
    System.out.println(Thread.currentThread().getName() + " done");
    return list;
}

public static void main(String[] args) throws InterruptedException {
    Thread t1 = Thread.ofVirtual()
                      .name("thread 1")
                      .start(() -> findPrimeNumbers(1, 200_000));
    Thread t2 = Thread.ofVirtual()
                      .name("thread 2")
                      .start(() -> findPrimeNumbers(1, 200_000));
    Thread t3 = Thread.ofVirtual()
                      .name("thread 3")
                      .start(() -> findPrimeNumbers(1, 50));

    t1.join();
    t2.join();
    t3.join();
    System.out.println("done");
}

```

Third virtual thread won’t get scheduled until one of the first two is completed:

```console
$ java -XX:ActiveProcessorCount=2 VirtualDelayDemo.class
thread 1 started
thread 2 started        ---> delay here
thread 1 completed
thread 3 started
thread 3 completed
thread 2 completed
done
$ _
```

If we switch the third thread (or all of them), to a platform thread, they all start executing right away:

```console
$ java -XX:ActiveProcessorCount=2 VirtualDelayDemo.class
thread 3 started
thread 2 started
thread 1 started
thread 3 completed
thread 2 completed
thread 1 completed
done
$ _
```

#### What if the operation is both blocking and CPU intensive?

We'll send the CPU intensive part to its executor and block the virtual thread we're in:
```java
...
Future<List<Long>> future = cpuIntensiveExecutor.submit(() -> findPrimeNumbers(1, 1000));
List<Long> result = future.get();
...
```


## Conclusion

CPU intensive tasks will disrupt the scheduling of virtual threads. Both CPU intensive and low latency / high priority tasks should be run on platform threads, in a separate thread pool. This is why JVM runs garbage collector and compiler threads on platform threads, even though they may be idle from time to time. They should not get in the queue behind virtual threads.

**Virtual threads are good for tasks which,**
 - May get blocked 
 - Don’t have critical latency requirements
 - Are plenty

**Platform threads are good for tasks which,**
 - Are CPU bound
 - Have low latency or predictable scheduling requirements
 - Are comparatively few in numbers


#### Summary of differences

<div class="table800 bordered-table"></div>

| **Platform**                            | **Virtual**                                    |
|-----------------------------------------|------------------------------------------------|
| Expensive to create, finite             | Cheap to create, uses much less memory *       |
| Scheduled by the OS, preemptively       | Scheduled by the JVM, when blocked or finished |
| Can have different priority than normal | Priority is fixed to normal                    |
| Can be daemon, is not daemon by default | Always daemon                                  |
| Has auto-generated name by default      | Default name is empty string                   |

<div style="height: 50px"></div>

<sup>*</sup><span class="subtext">A quick measurement indicates that a platform thread allocates around 64KB memory initially, a virtual thread around 2KB. Also, a platform thread reserves ~1024 KB on X86 and ~2048 KB on ARM64 of virtual memory for its stack.</span>
