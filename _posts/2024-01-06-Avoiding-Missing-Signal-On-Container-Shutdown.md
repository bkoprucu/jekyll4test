---
title: "Avoiding missing signal on container shutdown"
excerpt_image: assets/images/posts/2024-01-06-Avoiding-Missing-Signal-On-Container-Shutdown/Shipwreck_Concept_c.webp
excerpt_image_copyright: 'Rust concept art'
seo_enabled: true
excerpt_text: "Missing 'exec' command on dockerfile / shell script may cause the containerized process to miss the SIGTERM signal"
categories: [DevOps]
tags: [Kubernetes, Docker, DevOps, Java, Spring Boot]
---

## How shutdown signal can be missed by the container 

Missing 'exec' command on dockerfile / shell script may cause the containerized process to miss the SIGTERM signal sent by the container manager.

This will cause the process being stopped with the SIGKILL signal, without properly releasing the resources, potentially leaving the system in an inconsistent state.

To demonstrate this, we use the snippet below, which waits for a termination signal and triggers a shutdown hook before exiting: 

```java
public static void main(String[] args) {
    Runtime.getRuntime().addShutdownHook(
            new Thread(() -> System.out.println("Clean shutdown")));

    System.out.println("PID: " + ManagementFactory.getRuntimeMXBean().getPid());

    try {
        new CountDownLatch(1).await();
    } catch (InterruptedException e) {
        System.out.println("Interrupted");
    }
}
```

We will run this using a shell script:

```console
#!/bin/sh
# docker-entrypoint.sh
java -jar app.jar
```

...and Dockerfile: 

```dockerfile
FROM azul/zulu-openjdk-alpine:17-jre

WORKDIR app
COPY target/app.jar .
COPY docker-entrypoint.sh .
ENTRYPOINT ["./docker-entrypoint.sh"]
```

We run the container. Note that the PID is not 1. 

```console
$ docker build -t shutdowndemo .
...
$ docker run --name demo shutdowndemo
PID: 5
```

No "Clean shutdown" message is written, when stopping the container: 

```console
$ docker stop demo
$ _
```

The reason is that instead of our program, the shell script `docker-entrypoint.sh` has been assigned to PID 1, which received the SIGTERM signal from Docker.

Executing `cat /proc/1/cmdline` in the container confirms this (`ps` command is missing in the container):

```console
$ docker exec demo cat /proc/1/cmdline
/bin/sh./docker-entrypoint.sh
```

Container manager stops the container by sending a SIGKILL signal, after a timeout.
Since the application starts successfully, the problem may go unnoticed.

## Fixing with 'exec'

```bash
#!/bin/sh

# docker-entrypoint.sh

# ... 
 
exec java $JAVA_OPTS -jar app.jar "$@"
```

Updated container triggers the hook on exit:

```console
$ docker run --rm --name sdemo shutdowndemo
PID: 1
 
Clean shutdown
$ _
```

### Without the shell script

The `exec` command should be added to `Dockerfile` if no shell script is used: 

```dockerfile
FROM azul/zulu-openjdk-alpine:17-jre

WORKDIR app
COPY target/app.jar .
ENTRYPOINT exec java -jar app.jar
```


>#### Isn't PID 1 the init process?
>Linux provides namespaces for various system resources, including PID, which is used for virtualization.

## Failing fast

This Spring Boot example aborts startup if the PID is not 1 for the 'kubernetes' and 'docker' profiles.

```java
@Component
public class PidChecker {

    private static final Logger log = LoggerFactory.getLogger(PidChecker.class);

    private final ConfigurableApplicationContext context;

    public PidChecker(ConfigurableApplicationContext context) {
        this.context = context;
    }

    @PostConstruct
    void onStart() {
        if(Stream.of(context.getEnvironment().getActiveProfiles())
                 .anyMatch(profile -> 
                       List.of("kubernetes", "docker").contains(profile))
                && ManagementFactory.getRuntimeMXBean().getPid() != 1) {
            log.error("PID is not 1 for containerized profile, shutting down");
            context.close();
        }
    }
}
```
