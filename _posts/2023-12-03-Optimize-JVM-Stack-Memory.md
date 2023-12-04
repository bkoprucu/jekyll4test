---
title: "Can We Tune JVM Stack Size For Better Scalability?"
#subtitle: 
excerpt_text: "Finding the effect of -Xss option, and a potential bug in JVM"
categories: [JVM]
tags: [Java, DevOps, JVM, Monitoring, Reducing Cloud Costs]
---

<style>
div.narrow_table {
   + table {
    width: 600px;
    margin-left: 50px;
  }
}
div.narrow_table2 {
   + table {
    width: 400px;
    margin-left: 50px;
  }
}
</style>

## Finding the effect of -Xss option, and a potential bug in JVM

Reducing memory footprint of threads will improve scalability and lower cloud costs.

Default JVM stack size, which is [documented as 1024k](https://docs.oracle.com/en/java/javase/17/docs/specs/man/java.html#extra-options-for-java), seems wasteful for many applications.

I took an experimental approach to find out answers to the following:

- **Can we improve scalability by changing JVM stack size? (-Xss)**
- **What does -Xss JVM argument actually do? How does it affect the memory usage?**

While doing that, I came across some weird behavior of JVM under MacOS.

Scalability gains from such optimization won't approach those that can be achieved by using reactive programming or Java Virtual Threads (or Kotlin coroutines, etc.),
but not everything will or should use virtual threads.


## What Is A Thread Stack?

**Thread stack**  is the memory section, reserved separately for each thread. It holds:
- Method call stack, i.e. the list of methods and their arguments until current execution point.
- Local primitives defined in the method.
- Local references to objects defined in the method. The objects themselves are stored in the heap.

**Heap** is the "main" memory section, where all the objects, including primitives and references defined in the objects are stored. It is shared among the threads.  

Memory allocation is a deep and platform dependant topic, so this is a very short summary of the two memory sections, most interesting ones for usual software engineering tasks. 


## Default JVM Thread Stack Size

[Documented](https://docs.oracle.com/en/java/javase/17/docs/specs/man/java.html#extra-options-for-java) size of the thread stack is 1024 KB, which is true for X86 platform, it is however 2040 KB or 2048KB depending on operating system and Java version:

```text
$ java -XX:+PrintFlagsFinal -version | grep -i threadstack
     intx CompilerThreadStackSize                  = 2048
     intx ThreadStackSize                          = 2048
     intx VMThreadStackSize                        = 2048
```

<div class="narrow_table"></div>

| Platform             | Java 8  | Java 11 | Java 17 | Java 21 |
|----------------------|---------|---------|---------|---------|
| X86 / MacOS or Linux | 1024 KB | 1024 KB | 1024 KB | 1024 KB |
| ARM 64 / MacOS       | 2048 KB | 2048 KB | 2048 KB | 2048 KB |
| ARM 64 / Linux       | 2048 KB | 2048 KB | 2040 KB | 2040 KB |


#### VMThreadStackSize

This is the [native method stack size](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html#jvms-2.5.6), max. size of the stack reserved for native method calls. Default size is usually same as the thread stack size.

Can be set (in KB units) with the JVM option `-XX:VMThreadStackSize`.


## What Does '-Xss' JVM Option Do?

[Oracle's Java Tool Documentation](https://docs.oracle.com/en/java/javase/17/docs/specs/man/java.html#extra-options-for-java) states the following about the **-Xss** option:

> Sets the thread stack size (in bytes). Append the letter k or K to indicate KB, m or M to indicate MB, or g or G to indicate GB. The default value depends on the platform:
>
> Linux/x64 (64-bit): 1024 KB
>
> macOS (64-bit): 1024 KB
>
> Windows: The default value depends on virtual memory

Does the stack memory get allocated dynamically? Probably. If yes, does -Xss option set the maximum value of it?

[JVM Specification](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html#jvms-2.5.2) doesn't define this, leaving the behavior to the implementation of the JVM.


## Testing

### Implementation

We'll write a simple piece of code,  which allows controlling the number of threads spawn, and size of the heap and stack allocated by each thread.

You may get the implementation from [here](https://github.com/bkoprucu/article-jvm-stack-memory).

We'll call a recursive method is to fill the stack:

```java
void fillStack(int frameCount) {
   // Unused primitives defined to consume stack on each frame, 
   // since "frames may be heap allocated" : https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html#jvms-2.5.2
    var p1 = 1L; 
    var p2 = 1L;
    if (frameCount > 0) {
        fillStack(frameCount - 1);
    }
}
```
<br>

And method below to spawn the threads. Each thread will allocate stack memory by calling `fillStack()` and heap by defining an array:

```java
public void spawnThreads(int threadCount, int heapPerThread, int frameCount) {
    System.out.println("\nSpawning " + threadCount + " threads, each consuming ~" + heapPerThread + " KB heap, "
                               + frameCount + " stack frames\n");

    IntStream.rangeClosed(1, threadCount).forEachOrdered(value -> new Thread(() -> {
        // Allocate heap memory
         byte[] heapArr = new byte[heapPerThread * 1024];
         // Allocate stack memory
         fillStack(frameCount);
         System.out.print("\r" + threadCount + " threads created");
         // Block thread for measuring
         try {
             countDownLatch.await();
         } catch (InterruptedException e) {
             throw new RuntimeException(e);
         }
    }).start());

    System.out.println("\nPID: " + ManagementFactory.getRuntimeMXBean().getPid());
}
```
<br>


### Test setup

OS: 	MacOS 13.6.2
Platform:	ARM64, X86-64
Docker Engine:	24.0.6
JVM: Amazon Corretto 21.0.1, 17.0.9, 11.0.21. 1.8.0_392


### Changing Stack Depth

We will test with 1536 MB heap limit, 1000 threads, ~100 KB sized object per thread, default JVM stack size (2048K).

We'll compare the memory usage for 0 and 1000 stack frames, with both native memory tracking and `ps` command.  



```
$ java -Xint -Xmx1536m -Xss2048k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 0
Spawning 1000 threads, each consuming ~100 KB heap, 1 stack frames

1000 threads created
PID: 62972
```
<br>
We focus on, heap and thread stack memory areas reported by native memory tracking:

```text
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

```text
$ ps -o rss,command -p 62972
RSS COMMAND
282336 /usr/bin/java -Xint -Xmx1536m -Xss2048k ... MemoryFiller 1000 100 0
```


Interestingly, testing with a stack depth of 1000 gives the similar native memory tracking result as zero stack depth:

```
$ java -Xint -Xmx1536m -Xss2048k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 1000
Spawning 1000 threads, each consuming ~100 KB heap, 1000 stack frames

1000 threads created
PID: 63571
```

```text
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

However `ps` command reveals the difference in memory usage, 276 vs 414 MB:  

```text
$ $ ps -o rss,command -p 63571
   RSS COMMAND
424032 /usr/bin/java -Xint -Xmx1536m -Xss2048k ... MemoryFiller 1000 100 1000
```

The behavior on other OS / platform and Java versions are the same.

The stack seems be allocated dynamically. 


### Changing JVM stack size

We will compare the memory usage on default (2040 KB for ARM64) and 512 KB stack size options.

We will test with 1.5GB of heap limit, 1000 threads and stack depth of 250:

OS: MacOS 13.6.2
Platform: ARM64 (Apple Silicon)
JVM: Amazon Corretto 8.0.392 , 11.0.21, 17.0.9, 21.0.1

#### Stack size = 2048 KB

```text
$ java -Xint -Xmx1536m -Xss2040k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 250
Spawning 1000 threads, each consuming ~100 KB heap, 250 stack frames

1000 threads created
PID: 8309
```

```text
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

```text
$ ps -o rss,comm -p 8309
   RSS COMM
313232 /usr/bin/java
```

#### Stack size = 512 KB

```text
$ java -Xint -Xmx1536m -Xss512k -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary com.berksoftware.article.jvmstack.MemoryFiller 1000 100 250
```

```text
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

```text
$ $ ps -o rss,comm -p 8530
   RSS COMM
314320 /usr/bin/java
```

#### Stack is allocated (mostly) dynamically

Although Native Memory Tracking report shows a correlation between committed memory and given stack size, resident set size on operation system remains roughly the same (~307 MB).

Stack memory is allocated dynamically, and JVM stack memory setting -Xss is there to define the maximum, except when JVM is running in a container. 

On MacOS / ARM platform Java 8 consumed 81% more memory, around 558 MB.

Java 11 consumed %20 more memory than other versions, on both MacOs and Linux, ARM and X86 platforms.
NMT report for Java 8 is here, which you may compare with Java 17 here. XXXX



### Testing In A Container

We will run our test inside a container with 2GB memory limit.

We will compare the memory usage of the container reported by Docker with different stack size settings.

MacOS 13.6.2
ARM64 (Apple Silicon)
JVM: Amazon Coretto JVM 17.0.9
2GB Container memory
Heap limit: 75% of container (1536 MB)
1000 Threads, ~100KB of heap for each, 250 stack frames
Docker Engine: 24.0.6


Executing `make install` will build and install the Docker image `memoryfiller` tagged with current version of Java from the Dockerfile in the [repository](https://github.com/bkoprucu/article-jvm-stack-memory): 

```dockerfile
ARG java_version
FROM amazoncorretto:${java_version}

ENV JAVA_NMT_OPTS="-Xint -XX:+UnlockDiagnosticVMOptions -XX:NativeMemoryTracking=summary"
ENV JAVA_OPTS=""

WORKDIR app
COPY target/classes .

ENTRYPOINT exec java $JAVA_OPTS $JAVA_NMT_OPTS com.berksoftware.article.jvmstack.MemoryFiller $0 $@
```

We use `-XX:MaxRAMPercentage=75` JVM option, to hint JVM set the heap limit to 75% of the container, in this case 1536 MB.

####  Odd JVM behavior on MacOS + Docker

We run containers with different stack size options:

```text
docker run -m 2g --memory-swap 2g --rm -d -e JAVA_OPTS="-Xss2040k -XX:MaxRAMPercentage=75" --name J17_2040k memoryfiller:java17 1000 100 250
docker run -m 2g --memory-swap 2g --rm -d -e JAVA_OPTS="-Xss1024k -XX:MaxRAMPercentage=75" --name J17_1024k memoryfiller:java17 1000 100 250
docker run -m 2g --memory-swap 2g --rm -d -e JAVA_OPTS="-Xss512k  -XX:MaxRAMPercentage=75" --name J17_512k  memoryfiller:java17 1000 100 250
```

`-m 2g` : Set the container memory to 2 GB
`--memory-swap 2g`: Prevent container from using swap memory.  that's how most of containers are hosted on the cloud.
`-XX:MaxRAMPercentage=75`: Limit JVM heap to 75% of container memory.
`-Xss512k`: JVM will use 512k of stack memory per thread. 
`memoryfiller 1000 100 250`: Spawn 1000 threads, each consuming ~100KB and 250 stack frames.


Analyzing memory usage with `docker stats` gives an unexpected result:

```text 
CONTAINER ID   NAME        CPU %     MEM USAGE / LIMIT    MEM %       PIDS
a23869439d44   J17_512k    0.25%     315.1MiB  / 2GiB     15.38%      1019
92d36fd73cbc   J17_1024k   0.25%     309.4MiB  / 2GiB     15.11%      1019
7a1e9f8a0361   J17_2040k   0.17%     1.967GiB  / 2GiB     98.33%      1019
```


Memory usage goes up dramatically, when heap size is set above 1024 KB.

This anomaly shows itself only on containers running under MacOS (both ARM and X86 platforms), with Java versions 8, 11 and 17, but not 21.

No such behavior on Linux.


#### Increasing number of threads

How much effect does this inefficiency on memory allocation has on scalability? 

We can observe this by increasing the threads until the container dies:

```text
docker run -m 2g --memory-swap 2g --rm -d -e JAVA_OPTS="-Xss1024k -XX:MaxRAMPercentage=75" --name J17_2040k memoryfiller:java17 7000 100 250
```

We can run around 7000 - 7200 threads. With stack size of 1024KB and below,

Which goes down to ~ 1050 when stack size is left as default (2040KB).

This behavior also shows itself on MacOS / X86, however, since  default stack size on X86 platform is 1024 KB, most of the containers will be unaffected. 


## Conclusion

- JVM Stack size option (-Xss) sets how much stack size can grow before throwing `StackOverFlowError`. It has no effect on memory usage or scalability, unless JVM is in a container on MacOS.
- Default stack size on ARM64 platform is 2040 or 2048 KB, depending on Java version / platform.
- If the JVM running in a container on MacOS, stack sizes above 1024 KB causes much higher memory usage, depending on stack size and number of threads. Macs on ARM platform (Apple silicon) are 
