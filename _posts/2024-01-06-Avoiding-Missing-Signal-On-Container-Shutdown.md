---
title: "Avoiding missing signal on container shutdown"
#subtitle: "Importance of PID 1"
seo_enabled: true
excerpt_text: "Missing 'exec' command on dockerfile / shell script may cause the containerized process to miss the SIGTERM signal"
categories: [DevOps]
tags: [Kubernetes, Docker, DevOps, Java, Spring Boot]
#hide: [related]
#published: false
#hidden: 1
---

### How shutdown signal can be missed by the container 

Missing 'exec' command on dockerfile / shell script may cause the containerized process to miss the SIGTERM signal sent by the container manager.

In this case the process gets stopped with the SIGKILL signal, without properly releasing the resources. This can leave the system in an inconsistent state.

To demonstrate this, we write simple application with a shutdown hook:

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

Execution is blocked at line 8 and waits for the termination signal, after which the shutdown hook should be triggered before exiting the application.

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

We run the container:

```console
$ docker build -t shutdowndemo .
...
$ docker run --name demo shutdowndemo
PID: 5
```

Note that the PID is not 1. 

```console
$ docker stop demo
$ _
```
No "Clean shutdown" message is written.

The reason is that instead of our application, the shell script `docker-entrypoint.sh` has been assigned to PID 1, which receives the TERM signal from Docker.

Sending the following command to the container will confirm this (we read the contents from `/proc`, since the `ps` command is missing in the container):

```console
$ docker exec demo cat /proc/1/cmdline
/bin/sh./docker-entrypoint.sh
```

After a timeout, container manager kills the container, killing the application process without releasing the resources.
Since the application starts successfully, the problem may go unnoticed.

### Fix: Adding the 'exec' command

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

#### Without the shell script

The `exec` command should be added to `Dockerfile` if no shell script is used: 

```dockerfile
FROM azul/zulu-openjdk-alpine:17-jre

WORKDIR app
COPY target/app.jar .
ENTRYPOINT exec java -jar app.jar
```


>#### Isn't PID 1 the init process?
>Linux provides namespaces for various system resources, including PID, which is used for virtualization.

### Preventative measure / failing fast

To be more safe, we can check the PID at startup and send a warning, or abort the startup.  

Here is a Spring Boot example for aborting the startup if PID is not 1 for profiles 'kubernetes' and 'docker':

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
