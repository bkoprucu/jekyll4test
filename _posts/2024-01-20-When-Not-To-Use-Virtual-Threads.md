---
title: "When not to use virtual threads in Java"
seo_enabled: true
excerpt_text: "We'll take a look at how platform and virtual threads are scheduled, demonstrate the consequences of using the wrong type of thread, and outline"
excerpt_image: /assets/images/posts/2024-01-When-Not-To-Use-Virtual-Threads/vt_vs_pt_meme-edit-s.webp
excerpt_image_max_width: '65%'
categories: [Programming]
tags: [Java, Virtual threads]
---

We'll take a look at how platform and virtual threads are scheduled, demonstrate the consequences of using the wrong type of thread, and outline the differences between them.

  
### Scheduling of platform threads


Platform threads are scheduled by the operating system. Active threads are distributed among CPU cores. When more threads arrive, CPU time is shared among unblocked threads; each thread is given a “time slice”. After the time is up, a kernel triggers an interrupt signal, which suspends the current thread and assigns the CPU to the next one. This behavior is transparent to the programmer (preemptive).

{%- include image.html url="/assets/images/posts/2024-01-When-Not-To-Use-Virtual-Threads/platform_thread_scheduling.png" description="Scheduling of platform threads under heavy load.<br>Note the even distribution of CPU time among the threads" -%}

This way, more active threads than CPU cores can run concurrently, and the execution of the scheduling thread starts without much delay.

This also makes it possible to control the priority of threads, by giving some threads more CPU time.

A blocked thread is removed from the scheduling loop, until it becomes unblocked.

Many service application threads spend a good amount of time being blocked, while waiting for a response from another service call or database operation etc., causing an inefficient use of threads:

{%- include image.html url="/assets/images/posts/2024-01-When-Not-To-Use-Virtual-Threads/platform_thread_sleep.png" description="Platform thread idling on blocking operation" -%}

When no threads are available, the application will come to a halt, despite CPU usage being low.    


### Scheduling of virtual threads

Virtual threads are queued tasks. Unlike platform threads, their scheduling and queueing is managed by the JVM (ForkJoinPool).

{%- include image.html url="/assets/images/posts/2024-01-When-Not-To-Use-Virtual-Threads/vt_scheduling2.png" description="Scheduling of virtual threads" -%}

Here we see T1 is used as a carrier thread (a platform thread in schedulers pool for executing virtual threads), and it runs virtual threads VT2 and VT3 while waiting for VT1 to get unblocked. Note the uneven scheduling periods of the threads.

1. Virtual thread (or task) is taken from the queue, and mounted onto one of the available platform threads of scheduler. Here VT1 mounted on T1.
2. It gets executed until it is blocked or finished. VT1 is blocked by making an external service call, it gets unmounted, meaning it's stack is saved to heap, its status is set to 'parked' (blocked) and put in the schedulers queue.
3. Scheduler takes virtual thread VT2 from the queue, runs using T1. After VT2 is finished, it does the same for VT3. 
4. Response from the external service is received, VT1 can be scheduled. What actually happens here is that operating system notifies the JVM about I/O resource being ready. The message is forwarded to the scheduler, which removes the blocked status of VT1 ('parked' -> 'runnable'). But VT1 cannot be scheduled right away, because all the carrier threads are busy.
5. When VT3 is finished, carrier thread T1 becomes available. Scheduler runs it on T1. 


### Culprit: Delayed execution with CPU intensive operations

The scheduler does not have a control over when a virtual thread will be scheduled or how much CPU time it will get. Scheduling only occurs when a running virtual thread gets blocked or finished. Therefore, the waiting time for the virtual threads in the queue can be long and unpredictable.


#### Demonstrating delayed execution of a virtual thread

To demonstrate this easily, we will allow JVM to use two CPU cores, with JVM argument `-XX:ActiveProcessorCount=2`.

We start two virtual threads and give them CPU heavy tasks, and a third one doing less work:

```java

// CPU intensive method, not tested for correct functionality
static List<Long> findPrimeNumbers(long from, long to) {
    System.out.println(Thread.currentThread().getName() + " started");
    if (from < 0 || to < from)
        return Collections.emptyList();
    List<Long> list = LongStream.rangeClosed(from, to)
             .filter(i -> i == 1 || i == 2 ||
                     LongStream.range(2, i)
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

If we switch the third thread (or all of them), to platform thread, they'll start executing right away:
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

Sending the CPU intensive part to the specific executor and blocking the virtual thread will do the trick:
```java
...
    // Send CPU intensive task to executor with platform threads
    Future<List<Long>> future = cpuIntensiveExecutor.submit(() -> findPrimeNumbers(1, 1000));
    // Block the virtual thread
    List<Long> result = future.get();
...
```

### Conclusion

**Virtual threads are good for tasks which,**
 - May get blocked / will be I/ O or lock bounded
 - Are plenty
 - Don’t have critical latency requirements

**Platform threads are good for tasks which,**
 - Are CPU bound
 - Have low latency / predictive scheduling requirements
 - Are comparatively few in numbers


Both CPU intensive and low latency / high priority operations should be run in platform threads. This is why JVM runs garbage collector and compiler threads as platform threads, even though they may be idle from time to time. They should not get in the queue behind virtual threads.

A good strategy for low latency or CPU intensive tasks is to use a separate thread pool to run them. 

#### Other differences between platform and virtual threads
<div class="center-table table800 bordered-table"></div>

| : **Platform**                         : | : **Virtual**                                                        : |
|------------------------------------------|------------------------------------------------------------------------|
| Scheduled by the OS, preemptively        | Scheduled by JVM, when blocked or finished                             |
| Can have different priority than normal  | Priority is fixed to normal                                            |
| Can be daemon, not daemon by default     | Always daemon                                                          |
| Has auto-generated name by default       | Default name is empty string                                           |
