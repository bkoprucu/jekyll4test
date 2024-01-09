---
published: false
hidden: 1
---


```java
public class ShowArgsAndJVMOpts {
    public static void main(String[] args) {
        System.out.println("\nProgram arguments: " +
                                   Arrays.stream(args)
                                         .collect(Collectors.joining(", ")));


        System.out.println("\nJVM options: " +
                                   ManagementFactory.getRuntimeMXBean().getInputArguments()
                                                    .stream()
                                                    .collect(Collectors.joining(", ")));

    }
}
```

```shell
#!/usr/bin/env bash

java $JAVA_OPTS com.berksoftware.article.dockerargs.ShowArgsAndJVMOpts "$@"

```

```dockerfile
FROM amazoncorretto:17-alpine

WORKDIR app

COPY ShowArgsAndEnvVars.class .
COPY docker-entrypoint.sh .

ENTRYPOINT ["./docker-entrypoint.sh"]

```


```dockerfile
docker build -t args
```