---
title: "Managing microservices adoption - 1"
excerpt_text: "First part of ideas for managing adoption of microservices"
excerpt_image: "/assets/images/posts/2024-02-11-Managing-microservice-adoption-1/growtika-ZfVyuV8l7WU-unsplash-1.webp"
excerpt_image_copyright: 'Picture by unsplash.com/@growtika'
categories: [Engineering Management]
tags: [Microservices, Engineering Management]
---

Here are some management ideas for improving microservices adoption, based on my observations and experiences over the past decade.

### 1. Microservices architecture is expensive

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


### 2. Microservices is a solution to a management problem

The biggest benefit of using microservices architecture is more organizational than technical: Allowing agile teams to develop, deploy and innovate independently and promote continuous delivery.

Microservices architecture is also very closely aligned with agile methodologies.  

So it involves both the management and delivery teams. 

Therefore, **making sure everyone sees microservices as more than just a technical solution will help us get the resources needed for proper establishment of microservices and agile methodologies.** 


### 3. Shared libraries among services are tricky to manage

In the early stages of building a system, it may seem like a good idea to share reusable code by introducing a library. Initially, it improves productivity and consistency.

However, if not manged carefully, these libraries tend to create tight coupling between services, compromising the autonomy of the teams. 

As the organization grows, the ownership of the library may become ambiguous, leading to multiple teams making changes on it. Given that any alteration could disrupt the work of other teams, developers can only introduce new code, not make any modifications or deletions. Over time, this results in a large and difficult to manage codebase.

Even with a designated owner, meeting requirements of all the teams can be a challenge. Transient dependencies of the library can make upgrades and adoption of different technologies harder. This goes against another promise of microservices; "Fast and independent innovation".

#### The following can assist in managing libraries within microservices:

- If domain-wide libraries are used, they should:
    - Owned by a designated team, responsible for maintaining the library, reviewing, and merging pull requests, including those created by other teams.
    - Maintain a clearly defined scope of functionality.
    - Avoid introducing unnecessary transient dependencies.

- Libraries limited to a team scope typically pose fewer problems, allowing teams to make changes to their own library freely.



_To be continued..._