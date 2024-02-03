---
title: "Can we optimize JVM stack size?"
seo_enabled: true
excerpt_text: "The effect of -Xss JVM option, and inefficient memory allocation on MacOS"
excerpt_image: assets/images/posts/2023-12-06-JVM-Stack-Memory/ajda-zinber-book-stack-cr2.webp
excerpt_image_copyright: Photo by unsplash.com/@azinber
categories: [DevOps]
tags: [Java, DevOps, JVM]
---

## The effect of -Xss JVM option, and inefficient memory allocation on MacOS

I'll try to answer the following questions with some tests and measurements:

- **What does the -Xss JVM argument actually do? How does it affect memory usage?**
- **Can scalability be improved by adjusting the JVM stack size?**

In the course of these tests, I encountered [memory allocation problem on MacOS.](#conclusion)


## Default JVM stack size

The default stack size for ARM64 platform is twice that of X86 platform:

```text
$ java -XX:+PrintFlagsFinal -version | grep -i threadstack
     intx CompilerThreadStackSize             = 2048
     intx ThreadStackSize                     = 2048
     intx VMThreadStackSize                   = 2048
```

**ThreadStackSize :** Stack size used by the application, can be set with '-Xss'<br>
**VMThreadStackSize :** [Native method stack size](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html#jvms-2.5.6), can be set with `-XX:VMThreadStackSize`


<div class="table600 bordered-table center-table"></div>

|                         | **8.0.397** | **11.0.21** | **17.0.9** | **21.0.1** |
|:------------------------|:-----------:|:-----------:|:----------:|:----------:|
| x86_64 / MacOS or Linux |    1024     |    1024     |    1024    |    1024    |
| ARM64 / MacOS           |    2048     |    2048     |    2048    |    2048    |
| ARM64 / Linux           |    2048     |    2048     |    2040    |    2040    |

<div class="imginc">Default stack size of major Java versions (in KB)</div>


## What does the -Xss JVM option do?

It defines how much stack memory per thread is reserved in virtual memory. 

Actual memory allocation (virtual to physical mapping) happens dynamically, meaning that this setting determines the maximum size of the stack memory.

The tests below confirm this and also reveal [excessive memory allocation when running JVM in containers on a MacOS host](#excessive-memory-usage-on-macos)

## Testing

### Setup

<div class="headless-table"></div>

|                        |                      |                                                  |
|------------------------|----------------------|--------------------------------------------------|
| **Operating Systems**  | &nbsp; **\:** &nbsp; | MacOS 13.6 / Linux Ubuntu 22.04                  |
| **Architectures**      | &nbsp; **\:** &nbsp; | ARM64, X86_64                                    |
| **Java Versions**      | &nbsp; **\:** &nbsp; | Amazon Corretto 21.0.1, 17.0.9, 11.0.21, 8.0.392 |
| **Docker Engine**      | &nbsp; **\:** &nbsp; | 24.0.6                                           |


### Implementation

The code below (also on [GitHub](https://github.com/bkoprucu/article-jvm-stack-memory)) allows controlling the number of threads, stack depth, and heap allocation per thread: 


```java
/** Recursive method to fill the stack */
void fillStack(int frameCount) {
    // Unused primitives consume stack on each frame, since 
    // "frames may be heap allocated": https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html#jvms-2.5.2
    var p1 = 1L; 
    var p2 = 1L;
    if (frameCount > 0) {
        fillStack(frameCount - 1);
    }
}
```
<br>
For each thread, we allocate the heap and stack:

```java
public void spawnThreads(int threadCount, int heapPerThread, int frameCount) {
    System.out.println("\nSpawning " + threadCount + " threads, each consuming ~" 
            + heapPerThread + " KB heap, " + frameCount + " stack frames\n");

    IntStream.rangeClosed(1, threadCount).forEachOrdered(value -> new Thread(() -> {
         // Allocate heap
         byte[] heapArr = new byte[heapPerThread * 1024];
         // Allocate stack
         fillStack(frameCount);
         System.out.print("\r" + threadCount + " threads created");
         // Block the thread
         try {
             countDownLatch.await();
         } catch (InterruptedException e) {
             throw new RuntimeException(e);
         }
    }).start());

    System.out.println("\nPID: " + ManagementFactory.getRuntimeMXBean().getPid());
}
```

### Testing on the host

#### Changing the stack depth

We will start with Java 17 on MacOS on ARM64 architecture.

Our testing parameters include a 1536 MB heap limit, 1000 threads, each handling approximately 100 KB-sized objects in heap, and a JVM stack size option set to 2048 KB.

To assess memory usage, we'll compare scenarios with 0 and 1000 stack depth, employing both native memory tracking and the 'ps' command.

**Stack depth 0:**

```plaintext
$ java -Xint -Xmx1536m -Xss2048k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 0
Spawning 1000 threads, each consuming ~100 KB heap, 0 stack frames

1000 threads created
PID: 62972
```

NMT report:

```plaintext
Total: reserved=4981866KB, committed=2731770KB
       malloc: 27930KB #36432
       mmap:   reserved=4953936KB, committed=2703840KB

-                 Java Heap (reserved=1572864KB, committed=526336KB)
                            (mmap: reserved=1572864KB, committed=526336KB) 
...
-                    Thread (reserved=2112289KB, committed=2112289KB)
                            (thread #1025)
                            (stack: reserved=2109440KB, committed=2109440KB)
                            (malloc=1649KB #6163) 
                            (arena=1200KB #2048)
...
```

The NMT report inaccurately indicates the stack memory is allocated eagerly. Therefore, we measure the native memory usage with `ps`: 

```plaintext
$ ps -o rss,command -p 62972
RSS COMMAND
282336 /usr/bin/java -Xint -Xmx1536m -Xss2048k ... MemoryFiller 1000 100 0
```

**Stack depth 1000:**

```shell
$ java -Xint -Xmx1536m -Xss2048k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 1000
Spawning 1000 threads, each consuming ~100 KB heap, 1000 stack frames

1000 threads created
PID: 63571
```

Once again, NMT fails to provide useful information regarding stack memory allocation:

```plaintext
Total: reserved=4981861KB, committed=2731829KB
       malloc: 27925KB #36322
       mmap:   reserved=4953936KB, committed=2703904KB

-                 Java Heap (reserved=1572864KB, committed=526336KB)
                            (mmap: reserved=1572864KB, committed=526336KB) 
... 
-                    Thread (reserved=2112289KB, committed=2112289KB)
                            (thread #1025)
                            (stack: reserved=2109440KB, committed=2109440KB)
                            (malloc=1649KB #6163) 
                            (arena=1200KB #2048)
...
```

'ps' command reveals the difference in total memory usage, **276 vs 414 MB**:

```plaintext
$ ps -o rss,command -p 63571
   RSS COMMAND
424032 /usr/bin/java -Xint -Xmx1536m -Xss2048k ... MemoryFiller 1000 100 1000
```

Other OS / platform / Java versions behave similarly.

Thread stack is allocated dynamically. 


#### Changing JVM stack size

We'll analyze memory usage under the effects of 2048KB and 512KB JVM stack size configurations.

Test parameters: 1536 MB heap limit, 1000 threads, 100 KB sized object on each thread, 250 stack frames per thread.

**2048 KB:**

```plaintext
$ java -Xint -Xmx1536m -Xss2048k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 250
Spawning 1000 threads, each consuming ~100 KB heap, 250 stack frames

1000 threads created
PID: 8309
```

```plaintext
Native Memory Tracking:

Total: reserved=4981850KB, committed=2731690KB
       malloc: 27914KB #36250
       mmap:   reserved=4953936KB, committed=2703776KB

-                 Java Heap (reserved=1572864KB, committed=526336KB)
                            (mmap: reserved=1572864KB, committed=526336KB) 
... 
-                    Thread (reserved=2112289KB, committed=2112289KB)
                            (thread #1025)
                            (stack: reserved=2109440KB, committed=2109440KB)
                            (malloc=1649KB #6163) 
                            (arena=1200KB #2048)
...
```

```plaintext
$ ps -o rss,comm -p 8309
   RSS COMM
313232 /usr/bin/java
```

**512 KB:**

```plaintext
$ java -Xint -Xmx1536m -Xss512k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 250
```
Total committed memory appears less than half of 2048 KB stack size:

```plaintext
Native Memory Tracking:

Total: reserved=3432025KB, committed=1181993KB
       malloc: 27913KB #36277
       mmap:   reserved=3404112KB, committed=1154080KB

-                 Java Heap (reserved=1572864KB, committed=526336KB)
                            (mmap: reserved=1572864KB, committed=526336KB) 
... 
-                    Thread (reserved=562465KB, committed=562465KB)
                            (thread #1025)
                            (stack: reserved=559616KB, committed=559616KB)
                            (malloc=1649KB #6163) 
                            (arena=1200KB #2048)
...
```

Memory usage on the OS is more or less the same:

```plaintext
$ ps -o rss,comm -p 8530
   RSS COMM
314320 /usr/bin/java
```

#### Results

 - Although the Native Memory Tracking report indicates a connection between committed memory and provided stack size, the resident set size on the operating system remains constant, at around 307 MB.

 - So the stack is allocated dynamically and the JVM stack size option **-Xss** sets the limit on how much it can grow. 

 - **Java 8 and 11 utilizes memory less efficiently on MacOS:**

   - On MacOS / ARM64, Java 8 utilized around 80% more memory, compared to Java 17 and 21.

   - On MacOS, for both ARM and x86 architectures, Java 11 utilized around 20% more memory then Java 17 and 21.

NMT reports for MacOs are [here](https://github.com/bkoprucu/article-jvm-stack/tree/main/nmt-reports)


### Testing in a container


We will compare the container's memory usage as reported by Docker under various stack size configurations.

[This implementation](https://github.com/bkoprucu/article-jvm-stack/) is used to create images tagged with current Java version.

**Test parameters:**
- Container memory limit: 2GB                                               
- Heap limit: 75% of the container (1536 MB)                                

We initiate our testing with the following OS / JVM configuration:
- OS / Architecture: MacOS 13.6 / ARM64
- JVM: Amazon Corretto 17.0.9


We run containers with JVM stack size options of 2040 KB, 1024 KB and 512 KB:

```plaintext
$ docker run -m 2g --memory-swap 2g --rm -d -e JAVA_OPTS="-Xss2040k -XX:MaxRAMPercentage=75" --name J17_2040k memoryfiller:java17 1000 100 250
$ docker run -m 2g --memory-swap 2g --rm -d -e JAVA_OPTS="-Xss1024k -XX:MaxRAMPercentage=75" --name J17_1024k memoryfiller:java17 1000 100 250
$ docker run -m 2g --memory-swap 2g --rm -d -e JAVA_OPTS="-Xss512k  -XX:MaxRAMPercentage=75" --name J17_512k  memoryfiller:java17 1000 100 250
```

Docker arguments used: 
<div class="headless-table"></div>

|                                    |    |                                           |
|-----------------------------------:|----|-------------------------------------------|
|                            `-m 2g` | \: | Limit container memory to 2 GB            |
|                 `--memory-swap 2g` | \: | Prevent container from using swap memory  |
|          `-XX:MaxRAMPercentage=75` | \: | Limit JVM heap to 75% of container memory |


#### Excessive memory usage on MacOS

We see a high memory usage reported by 'docker stats' on container with 2040 KB stack size:

```plaintext
  NAME        CPU %     MEM USAGE / LIMIT    MEM %       PIDS
  J17_512k    0.25%     315.1MiB  / 2GiB     15.38%      1019
  J17_1024k   0.25%     309.4MiB  / 2GiB     15.11%      1019
  J17_2040k   0.17%     1.967GiB  / 2GiB     98.33%      1019
```

Memory usage increases dramatically for stack sizes larger than 1024 KB. 

This anomaly only shows up on containers running on MacOS (both ARM64 and x86_64 architectures), with LTS Java versions 17 and below.

Linux is unaffected, as is Java 21.


#### Increasing number of threads

Lastly, we will find the maximum number of threads that can be run in a container with different stack size configurations.  


```plaintext
docker run -m 2g --memory-swap 2g --rm -d -e JAVA_OPTS="-Xss1024k -XX:MaxRAMPercentage=75" --name J17_2040k memoryfiller:java17 7000 100 250
```

On MacOS with default stack size (2040 KB), container gets killed by Docker after ~1050 threads.

With a decreased JVM stack size of 1024 KB (-Xss1024k option), we can go up to ~7100 threads. Further reducing the stack size does not have an impact.

Like the previous test, this only occurs on MacOS, with LTS Java versions 17 and below. 


## Conclusion

- JVM Stack size option '-Xss' determines how much virtual memory is reserved per thread. Since actual memory allocation occurs dynamically, this does not affect total memory usage, or scalability, besides the minimum effect of mapping table size, but,

- **Significant high memory usage has been observed on Java versions 8 - 17 running in a container on MacOs, when the stack size is set more than 1024 KB**.

- The default stack size on ARM64 architecture being [twice of X86 architecture](#default-jvm-stack-size) result in Macs with Apple Silicon encountering the mentioned high memory consumption issue with the default JVM configuration. 

- **Java 8 and Java 17 on MacOS allocates memory less efficiently than Java 17 and 21, [the difference is bigger on Java 8](#results)** You may check native memory tracking reports [here](https://github.com/bkoprucu/article-jvm-stack/tree/main/nmt-reports).  


Only a few services require more than 1024 KB of stack, with Elasticsearch being one of them. Using Java 21 or applying `-Xss1024k` argument will lower the memory consumption of containers.