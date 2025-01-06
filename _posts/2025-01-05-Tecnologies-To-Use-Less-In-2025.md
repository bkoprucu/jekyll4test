---
title: "JVM Technologies To Use Less In 2025"
published: false
seo_enabled: false
description: "JVM Technologies we should use less in 2025"
#excerpt_text: "We’ll explore some common challenges organizations face when implementing microservices"
categories: [Engineering Management]
tags: [JVM, Java]
hidden: true
---

## Reactive frameworks (Spring Reactor, RxJava, Vert.x etc.)
// Virtual threads are making them less needed. Though they offer better control over scheduling and backpressure, so they are here to stay, but we'll be using them less.
// Same goes for `ComletableFuture`, default async programming functionality in Java. There will be less incentive to use them.
// With the arrival of Java 24, `synchronized` blocks on Virtual Threads will be handled without pinning, and other performance improvements will arrive, making Virtual Threads even more viable.
// Important parts for effective concurrent programming are still in the works: Scoped values and Structured concurrency. With their arrival and better support of Virtual Thread compatible (Loom friendly), libraries and drivers, the scalability gap between existing reactive libraries and Virtual Threads will shrink. 
// Simplicity in debugging, better serviceability and manageability will make Virtual Threads a better or cheaper alternative for many solutions. Reactive libraries will still have their place, but will be more of a niche solution, than a necessity for scalability.

## Lombok
// I've covered pros and cons of using Lombok and its risks in another [article](https://berksoftware.com/24/10/Using-Lombok-wisely). In short, while some Lombok annotations can be useful, others can be risky, or improving code visually, but team productivity not much. 
// With Java 24, changes in the Java compiler to improve security will prevent Lombok from working. Configuring build pipelines to run Java compiler in less secure way seems to contradict with productivity improvements we expect from Lombok, making it less favorable to use.        


## JPA
// Being the default ORM library and learned as default way to access databases by many developers, this tends to be used more than it should. It is powerful, but can be tricky to master and configure properly. This often leads to suboptimal queries and data model. It's design tends to lead some developers to introduce more (primary-foreign key) relations between tables, meaning more locks and system difficult to distribute to microservices. Many projects can be managed better with alternatives such as: Spring Data JPA, JDBI, JOOQ,... 

## Vavr
// When Java 8 finally introduced some functional programming features, developers with experience on functional programming and Scala noticed missing parts and gave us Vavr. They also considered the compromised implementations like `Optional<>` not being monadic. It was a good addition, but over time, Java has evolved to different direction, and Vavr has stalled. Scala suit didn't fit Java well. Some functionalities didn't scale good and many classes got deprecated. Java's own improvements, backed up with changes in the JVM, has been a better choice. For many Vavr has become a library to use on handling exceptions on lambdas / Stream API. Even that is problematic; debugging is hard, exceptions which may be thrown in exception handling routine being handled by an additional callback makes whole thing hard to manage. That's more Java's shortcoming, but yet again, it doesn't become Scala with a library, and accepting and using modern Java as it is has been the right choice for many.

