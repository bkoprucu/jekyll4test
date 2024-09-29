---
title: "Using Lombok wisely: Questions to consider"
seo_enabled: true
hidden: false
excerpt_text: "Like any other tool, Lombok can be useful or misused. Misuse or overuse happens, which, probably is what makes Lombok..."
excerpt_image: /assets/images/posts/2024-09-Using-Lombok-Wisely/banner-lombok.webp
categories: [Programming]
tags: [Java, Lombok, Software Team Management]
redirect_from: "/24/9/Risks-Of-Using-Lombok"
---

Like any other tool, Lombok can be useful or misused. Misuse or overuse happens, which, probably is what makes Lombok polarizing.

Usefulness of it depends on factors like, the development team, project requirements, which Lombok annotations are being used etc.

Questions in this article may help to reflect on these factors.


## Is Lombok a language extension?

Lombok generates and hides potentially repetitive code. Code generating tools cannot introduce new semantics or paradigms to the language. Therefore, the design of the software cannot (and shouldn't) change by using Lombok or similar tools.

Whether Lombok can be considered a language extension depends on the perspective; it brings visible syntax changes, but the actual capabilities and paradigms of the language remains the same.


## Is the improvement mainly visual?
 
Are we introducing a Lombok annotation because it makes the code look tidy, or is the design exactly the way we want as well? After all, we're still responsible from the hidden code it generates.

Sometimes, this compromise works well. For example, `@EqualsAndHashCode`, can help avoid mistakes when new fields are added to a class (also reduces reviewing time). Or, `@Builder` can improve readability, especially on inner classes, without compromising design.

Other times, visual simplicity might come at the expense of better design. If `@AllArgsConstructor` is used just for the concise visible code it provides, a validator can be missed as shown in the pseudocode below.

{%- include image.html url="/assets/images/posts/2024-09-Using-Lombok-Wisely/AllArgsConstructor_pseudo_sample.png" description="@AllArgsConstructor looks better, but is missing a validation" -%}


If the code has a potential for refactoring in the future, having the code clearly visible can help with reflecting on design decisions or applying new Java features. This is similar to how explaining code to a rubber duck can be helpful - out of sight can lead to out of mind. Yet again, some cases, like builders, might not need this.


## Are we delaying delivery with unproductive discussions?

Developers often have different opinions and experiences when it comes to using Lombok.

While some annotations may streamline development, others, like `@SneakyThrows` need careful consideration, [as noted by Lombok documentation](https://projectlombok.org/features/SneakyThrows). Lombok also includes experimental annotations, which come with [their own risk](https://projectlombok.org/features/experimental/). Some developers consider extralinguistic behavior of Lombok risky.

Lombok leaves it to the developers to assess the value of each annotation. This, together with the alternative syntax it provides, can lead to unproductive debates or longer review times. Since the purpose of Lombok is to boost productivity, it is worth reflecting on these discussions.

One solution can be to align the team on a common approach by having guidelines, such as "We are not using experimental features of Lombok", or encouraging team members to have deeper understanding of Lombok.
Alternatively, tools like [AutoValue](https://github.com/google/auto) or [Immutables](https://immutables.github.io/) might better fit the team's preferences and projects needs.


## Are multiple code manipulation tools in use?

Sometimes multiple tools and libraries can manipulate the code by changing AST or bytecode. 

Examples include dependency injection frameworks like Micronout, Quarkus or Dagger, AOP libraries like AspectJ, and circuit breakers like Hystix or Resilience4j.

Many frameworks provide a well-tested bill of materials (BoM) to ensure compatibility between these tools. Adding code manipulating libraries outside this set can occasionally lead to subtle issues, especially when multiple tools modify the same class. One time, I encountered a situation where circuit breakers were silently disabled because of this. 

In such cases, it is a good idea to test these tools against potential interference, and use them cautiously, whether it's Lombok or other code modifying tool.


## Did we consider native Java features instead of `@Builder` or `@With`?

By the time of writing this article, native withers for records are in development: [JEP-468](https://openjdk.org/jeps/468).

For builders: Named arguments like in Kotlin probably won't come to Java, but Project Valhalla's [value classes](https://openjdk.org/jeps/401) will promote domain driven design solutions (less primitive obsession), allowing for safer to constructors, which reduces the need for builders - perhaps a topic for another article.

If these features are present by the time you're reading, consider using them. (By now, most developers already prefer records over `@Value`, therefore I won't get into records here).


## Final thoughts

Not using Lombok won't improve the design, on the other hand, misusing or overusing it won't boost productivity.

It is up to the user or team to find the right balance. I hope this article can help with that.
