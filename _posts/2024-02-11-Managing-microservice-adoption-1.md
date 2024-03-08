---
title: "Managing microservices adoption - Part 1"
excerpt_text: "Here are some management practices for improving microservices adoption and avoiding pitfalls"
excerpt_image: "/assets/images/posts/2024-02-11-Managing-microservice-adoption-1/growtika-ZfVyuV8l7WU-unsplash-1.webp"
excerpt_image_copyright: 'Picture by unsplash.com/@growtika'
categories: [Engineering Management]
tags: [Microservices, Engineering Management]
hidden: true
---

Here are some management practices for improving microservices adoption and avoiding pitfalls on implementing microservices, based on my observations and experiences over the past decade.

## Microservices architecture is expensive

Using microservices introduces:

- More processes and containers.
- More network traffic, slower communication compared to modules withi the same process.
- More database instances.
- More build and deployment pipelines.
- Additional distributed system components: Service discovery, container orchestration, API gateway, configuration management etc.

All these factors contribute to a higher running and management costs.

A good strategy to keep costs down during the transition can be to start with a modular monolith architecture, and gradually migrate modules to microservices. More on that later.

To be able to justify the costs, we should be focusing on getting from microservices what it promises, and knowing what it promises.

Which brings us to...


## Microservices is a solution to a management problem

The biggest benefit of using microservices architecture is more organizational than technical: Allowing agile teams to develop, deploy and innovate independently and promote continuous delivery.

Microservices architecture is also very closely aligned with agile methodologies.  

So it involves both the management and delivery teams. 

Therefore, **making sure everyone sees microservices as more than just a technical solution will help us get the resources needed for proper establishment of microservices and agile methodologies.** 


## Shared libraries among services are tricky to manage

In the early stages of building a system, sharing reusable code by introducing a library improves productivity and consistency.

However, if not manged carefully, these libraries can create tight coupling between services, compromising the autonomy of the teams. 

As the organization grows, the ownership of the library may become ambiguous, leading to multiple teams making changes on it. To avoid disrupting the work of other teams, developers tend to only introduce new code, not make any modifications or deletions. Over time, this results in a large and difficult to manage codebase.

Besides that, transient dependencies of the library can make upgrades and adoption of different technologies harder. This goes against another promise of microservices; "Fast and independent innovation".


#### The following can assist in managing libraries within microservices:

- If domain-wide libraries are used, they should:
    - Owned by a designated team, responsible for maintaining the library, reviewing, and merging pull requests, including those created by other teams.
    - Maintain a clearly defined scope of functionality.
    - Avoid introducing unnecessary transient dependencies.
- Libraries limited to a team scope typically pose fewer problems, allowing teams to make changes to their own library freely.


## Establish an API evolution strategy early on 

A well-designed microservices architecture has two main pillars:

- Good separation of concerns between the services: Each service performs a distinct task within the business domain.
- Robust API: This contract between services (and clients), which enables efficient task execution without restricting independent service development.

Even with a good initial API design, changes will inevitably be necessary over time.

Modifying the API freely isn't viable as it risks disrupting communication between services and their consumers.

This problem is more apparent on point-to-point architecture (usually synchronous protocols like REST or gRPC), since the API itself builds more rigid dependency between services, but asynchronous, publish / subscribe architecture needs to be evolved as well.     

One approach is to avoid changing or removing anything from the API, only adding to it. While this will work, it can lead to a less understandable domain over time, particularly for new team members.

Alternatively, API versioning can be implemented. Changes are made to a new version of the API, with both old and new versions running simultaneously. Consumers are notified of the change, and once it's certain that the older API is no longer in use, it can be removed. 

While technologies like Hypermedia can aid in (synchronous) API evolution, but AFAIK, there isn't a comprehensive protocol, library, or tool specifically designed for the purpose of API evolution and expiration.

Therefore, good traceability of the request flow and a policy (a management process) is needed for API evolution and expiration.

<br>


_Will continue with traceability on Part 2_