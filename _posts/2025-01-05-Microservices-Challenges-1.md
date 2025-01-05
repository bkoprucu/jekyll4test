---
title: "Microservices Challenges: Balancing Costs and Benefits – Part 1"
published: true
seo_enabled: true
description: "Discover key challenges in microservices adoption, from API evolution to team autonomy, and learn strategies to balance costs and benefits effectively."
#excerpt_text: "We’ll explore some common challenges organizations face when implementing microservices"
excerpt_image: "/assets/images/posts/2025-01-05-Microservices-Challenges-1/growtika-ZfVyuV8l7WU-unsplash-1.webp"
excerpt_image_copyright: 'Picture by unsplash.com/@growtika'
categories: [Engineering Management, Software Architecture]
tags: [Microservices, API Strategy, Software Team Management]
hidden: false
---

We’ll explore some common challenges organizations face when implementing microservices. These insights, drawn from years of experience, are practices that are sometimes postponed during the early stages. Addressing them early on can bring significant benefits, as we've observed in systems that adopted them later.


## The main reason to use microservices

**Microservices architecture is primarily a solution to a management challenge: improving organizational scalability. It achieves that by enabling multiple teams to develop, test, and deploy independently.**

Other important benefits of microservices, such as easier integration and with external services, or using different technologies on different parts of the system are also worth remembering.

Pros and cons of microservices isn't our main topic - we will continue with the challenges of establishing it. 


## Challenges:

### 1. Using Microservices where we shouldn't

Let's remember;
- Microservices don’t mandate full commitment. Depending on the state and requirements, a system with a mix of microservices and monolithic parts could be optimal for a given domain.
- Microservices are inherently expensive; they involve multiple processes, containers, virtual machines, pipelines, data source instances, service discovery mechanisms, and more.


### Sample scenarios

Here are few scenarios where using microservices might not be optimal. Some ot them might be familiar. 

- #### Requirements and API are not yet stable
Microservices provide flexibility in many areas, but not when it comes to API. Changing an API can be a painful and sometimes compromised process. When requirements and API are still evolving, starting with a modular monolith can be a better choice. This allows modules and their interactions to evolve easier while avoiding the additional complexity and cost of microservices.

- #### No parallel working teams
When there aren't multiple teams to leverage the [main benefit of using microservices](#the-main-reason-to-use-microservices "Enabling multiple teams to develop, test, and deploy independently"), it might be wiser to avoid associated costs and management overhead. This is a common practice among startups, where resources are often limited.

- #### Multiple services serving the same or similar domain
Strong  interdependency (tight coupling) between services can occur at inception or during evolution of a system. This manifests as services needing to be deployed and tested together, slowing delivery. When services are managed by separate teams, communication overhead can worsen the issue. A change in design—such as merging them into a single modular service—may be a viable solution.

While a monolithic design allows flexible and effective communication between modules, this will  it’s important that the design remains clean, modular, and cohesive. This ensures the system can be managed easily, and migrate and integrate with microservices when the time comes.

To retain the focus of the article, we'll skip other scenarios.


### 2. Shared libraries becoming a coupling point

In the early, monolithic stages of system, sharing reusable code by introducing a library can improve productivity and consistency.

When applied to a microservices architecture, these libraries tend to become shared tight coupling points between services, compromising team autonomy if not managed carefully.

> Clear ownership of services is crucial when establishing microservices.

Library ownership may become ambiguous over time, with multiple teams making changes. To avoid disrupting others work, developers may avoid modifying existing code, opting only to add new ones. This leads to a bloated codebase.

On top of that, transient dependencies of the library may lead to dependency conflicts, getting in the way of upgrades and adoption of  different technologies.

Shared libraries also complicate working with external providers; should they depend on the library, or should the library adapt to their API changes over time?

All these issues undermine [the main benefit of using microservices](#the-main-reason-to-use-microservices "Enabling multiple teams to develop, test, and deploy independently").

Some strategies to manage this can be:

  - Developing smaller, atomic libraries with clearly assigned owners.
  - Letting teams maintain their own copy of libraries.
  - Avoiding in-house libraries and allowing some code duplication across services. (This may seem inefficient or controversial, but is much preferable over tight coupling. Service independence is the top priority of microservices)
  - Assigning a dedicated team to manage the library. (Can be challenging)

How and where these strategies can be applied can be a topic of another article.


## To be continued

In Part 2, we will continue exploring challenges like API evolution, distributed tracing, and more.
