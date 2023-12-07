---
title: "Can we optimize JVM stack size?"
#subtitle: 
seo_enabled: true
excerpt_text: "The effect of -Xss JVM option, and a potential bug in JVM"
categories: [DevOps]
tags: [Java, DevOps, JVM, Monitoring]
hide: [related]
---

## The effect of -Xss JVM option, and a potential JVM bug

The default JVM stack size is [known to be 1024 KB](https://docs.oracle.com/en/java/javase/17/docs/specs/man/java.html#extra-options-for-java), appears wasteful for many applications.

I conducted tests to answer following questions:

- **Can scalability be improved by adjusting JVM stack size?**
- **What does -Xss JVM argument actually do? How does it affect the memory usage?**

In the course of these tests, I encountered [memory allocation problem on MacOS.](#conclusion)


## What is a thread stack?

**Thread stack** is the memory section, reserved separately for each thread. It holds:
- Method call stack, i.e. the list of methods and their arguments until current execution point.
- Local primitives defined in the method.
- Local references to objects defined in the method. The objects themselves are stored in the heap.

**Heap** is the "main" memory section, where all the objects, including primitives and references defined in the objects are stored. It is shared among the threads.  

Memory allocation is a deep topic, so this is an overly simplified explanation of the two main memory areas.
  

## Default JVM stack size

We can get the stack size configuration of current JVM by executing:

```text
$ java -XX:+PrintFlagsFinal -version | grep -i threadstack
     intx CompilerThreadStackSize                  = 2048
     intx ThreadStackSize                          = 2048
     intx VMThreadStackSize                        = 2048
```
**ThreadStackSize** is the stack size used by Java applications, which can be set with '-Xss' JVM option.
**VMThreadStackSize** is the [native method stack size](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html#jvms-2.5.6). It can be set with `-XX:VMThreadStackSize` JVM option.

Here is the output of execution above on some Java / Os / architecture combinations: 
<div class="table600 center-table"></div>

|                         | **8.0.397** | **11.0.21** | **17.0.9** | **21.0.1** |
|:------------------------|:-----------:|:-----------:|:----------:|:----------:|
| x86_64 / MacOS or Linux |    1024     |    1024     |    1024    |    1024    |
| ARM64 / MacOS           |    2048     |    2048     |    2048    |    2048    |
| ARM64 / Linux           |    2048     |    2048     |    2040    |    2040    |

<div class="imginc">Default stack size of major Java versions (in KB)</div>


## What does the -Xss JVM option do?

Neither the [Java Tool Documentation](https://docs.oracle.com/en/java/javase/17/docs/specs/man/java.html#extra-options-for-java), nor the [JVM Specification](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html#jvms-2.5.2) specifies whether stack memory is allocated dynamically or not, leaving this and the behavior of the **-Xss** option to vendor implementation.  

Tests below show that it is mostly allocated dynamically, [with unusual behavior on MacOS.](#macos-anomaly)  


## Testing

### Setup

<div class="headless-table"></div>

|                        |        |                                                         |
|------------------------|--------|---------------------------------------------------------|
| **Operating Systems:** | **\:** | &nbsp; MacOS 13.6, Linux Ubuntu 22.04                   |
| **Architectures**      | **\:** | &nbsp; ARM64, X86_64                                    |
| **Java Versions**      | **\:** | &nbsp; Amazon Corretto 21.0.1, 17.0.9, 11.0.21, 8.0.392 |
| **Docker Engine**      | **\:** | &nbsp; 24.0.6                                           |


### Implementation

The code below allows controlling the number of threads and how much stack and heap will be allocated by each thread. You may get the implementation from [GitHub](https://github.com/bkoprucu/article-jvm-stack-memory).

Recursive method fills the stack:

```java
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
For each thread, we allocate heap by defining an array and stack by calling `fillStack()`

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


### Changing stack depth

We will start with Java 17 on MacOS on ARM64 architecture.

Our testing parameters include a 1536 MB heap limit, 1000 threads, each handling approximately 100 KB-sized objects in heap, and a JVM stack size of 2048 KB.

To assess memory usage, we'll compare scenarios with 0 and 1000 stack depth, employing both native memory tracking and the 'ps' command.

**Zero stack depth**

```plaintext
$ java -Xint -Xmx1536m -Xss2048k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 0
Spawning 1000 threads, each consuming ~100 KB heap, 0 stack frames

1000 threads created
PID: 62972
```

Native memory tracking report:

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

Memory usage seen by the operating system:

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

Native memory tracking report doesn't show a meaningful difference in stack memory usage:

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

Thread stack seems to be dynamically allocated. 


### Changing JVM stack size

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

 - This means that stack memory is allocated dynamically and the JVM stack size option **-Xss** only sets the limit of how much it can grow. 

 - **Java 8 and 11 utilizes memory less efficiently on MacOS:**

   - On MacOS / ARM64, Java 8 utilized around 80% more memory, 558 MB.

   - Again on MacOS, for both ARM and x86 architectures, Java 11 utilized around 20% more memory.

NMT reports for MacOs - Java versions 8, 11, and 17 are available at [this repository](https://github.com/bkoprucu/article-jvm-stack/tree/main/nmt-reports)


#### Testing in a container

The comparison will focus on the container's memory usage as reported by Docker under various stack size configurations.

[The implementation](https://github.com/bkoprucu/article-jvm-stack/) can be used to create images tagged with current Java version on Maven install phase.

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


### MacOs anomaly:

We see an abnormally high memory usage reported by 'docker stats' on container with 2040 KB stack size:

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

On MacOS with default stack size (2040 KB), container can run ~1050 threads, after which it is killed by container manager.

With a decreased JVM stack size of 1024 KB (-Xss1024k option), number of threads the container can run reaches ~7100 threads. Further reducing the stack size does not have an impact.

Like the former test, this behavior only occurs on MacOS, with LTS Java versions 17 and below. 


## Conclusion

- JVM Stack size option '-Xss' determines the maximum growth of the stack size before throwing  `StackOverFlowError`. It does not affect memory usage or scalability, unless the JVM is runs on MacOS within a container.

- **When the JVM is in the version range of 8-17 and operates within a container on MacOS, it consumes significantly higher memory when the stack size is set more than 1024 KB. However Java 21 is not affected by this issue.**

- The default stack size on ARM64 architecture is either [2040 or 2048 KB](#default-jvm-stack-size). This results in Macs with Apple Silicon encountering the mentioned issue with the default JVM configuration. 

- **Java 8 and Java 17 on MacOS allocates memory less efficiently than Java 17 and 21, [the difference is much bigger on Java 8](#results)** You may check native memory tracking reports [here](https://github.com/bkoprucu/article-jvm-stack/tree/main/nmt-reports).  


This will mainly affect the development environment, as MacOS is seldom used on servers. Only a few services require more than 1024 KB of stack, with Elasticsearch being one of them. Utilizing Java 21 or applying `-Xss1024k` argument to Java will lower the memory consumption of containers.