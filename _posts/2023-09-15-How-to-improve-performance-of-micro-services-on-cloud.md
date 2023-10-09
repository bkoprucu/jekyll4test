---
author: "Berk Koprucu"
excerpt_text: "We will improve it, I promise..."
excerpt_image: "/assets/images/test/data_center.jpg"
# published: false
tags: [AWS, Spring]
categories: [Java, Test, How to improve performance]
---

## How to improve performance?

Here is some java code:

```java
    @Override
    public Flux<Count> listCounters(Integer page, Integer size) {
        final int pg = page == null || page < 1 ? 0 : page;
        final int sz = size == null || size < 1 ? DEFAULT_ITEMS_PER_PAGE
                                : Math.min(size, MAX_ITEMS_PER_PAGE);
        return Flux.fromStream(() ->
                       distributedMap.entrySet()
                                     .stream()
                                     .skip((long) pg * sz)
                                     .limit(sz)
                                     .map(entry -> new Count(entry.getKey().toString(), entry.getValue())))
                   .subscribeOn(Schedulers.boundedElastic());
    }
```
