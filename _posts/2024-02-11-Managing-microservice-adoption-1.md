---
title: "Managing microservice adoption - 1"
excerpt_text: "First part of ideas for managing adoption of microservices"
excerpt_image: "/assets/images/posts/2024-02-11-Managing-microservice-adoption-1/growtika-ZfVyuV8l7WU-unsplash.webp"
excerpt_image_copyright: 'Picture by unsplash.com/@growtika'
categories: [Engineering Management]
tags: [Microservices, Engineering Management]
---

Here are some management ideas for improving microservices adoption, based on my observations and experiences over the past decade.

### 1. Microservices architecture is a solution to a management problem

The biggest benefit of using microservices is more organizational than technical: It allows agile teams to develop, deploy and innovate independently. 

It also offers organizational flexibility: Each team can become a supplier, which can be replaced by another supplier.

**As it involves both the management and the delivery teams, it is important for everyone to know (at least) the above aspect of microservices.** (I leave other aspects to another post)

Getting everyone on board and recognizing microservices as more than just a technical solution can help allocate the necessary resources for their proper establishment. 

It is expensive after all.


### 2. Microservices architecture is costly

Using microservices introduces:

- More processes and containers, which communicate over the network.
- More database instances.
- More build and deployment pipelines.
- Introduction of additional distributed system components, for service discovery, container orchestration, API gateway, configuration management, deployment coordination etc. 

All these factors contribute to higher running and management costs.

Starting with a modular monolith architecture, instead of going all-in on microservices, could help with managing costs. More on that later.   


### 3. Shared libraries among services are a trap

In the early stages of building a system, it may seem like a good idea to share reusable code by introducing a library. Initially, it improves productivity and consistency.

However, as the organization grows, multiple teams may have their hands on it. Any changes made may break a service managed by another team, so they are unable to modify or remove anything, they can only add new code. Over time, this results in a large pile of difficult to manage code.

These libraries also create a tight-coupling between services, compromising the autonomy of the teams. The promise of "having teams as suppliers" of microservices is broken. 

Often, the library brings some transient dependencies which makes upgrades or changing the technology harder. Another microservices promise, "fast and independent innovation" is also broken. 


#### The following practices can assist in managing libraries within microservices:

- Avoid mandating teams to use a domain-wide library.
- Teams may maintain their own libraries if they handle them carefully. 
- If domain-wide libraries are truly necessary, they should be small, focused on single functionality, don't bring in transient dependencies, and have a designated owner. Only the library's owner (team) should have the authority to merge changes.



_To be continued..._