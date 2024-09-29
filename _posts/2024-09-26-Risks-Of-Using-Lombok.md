---
title: "Risks of using Lombok"
seo_enabled: true
excerpt_text: "What could go wrong by using Lombok to automate boilerplate code generation in Java?"
excerpt_image: /assets/images/posts/2024-09-Risks-Of-Using-Lombok/banner-lombok.webp
categories: [Programming]
tags: [Java, Lombok]
---

## What Could Go Wrong by Using Lombok?

[Lombok](https://projectlombok.org/) is a widely used Java library that reduces boilerplate code, by providing annotations to generate them.

However, improper or excessive use of Lombok can introduce risks to software design, maintainability and manageability.

## Common Lombok Annotation Pitfalls

We'll look at some commonly used Lombok annotations, potential pitfalls associated with them, and how we can avoid these risks.


### `@AllArgsConstructor`, `@RequiredArgsConstructor`, `@NoArgsConstructor`

These annotations may lead to treatment of constructors as boilerplate, where there wasn't.

> Instance management in Java requires careful thought.

This may manifest itself as:

- Introducing a constructor where a factory method or another creation pattern should be.

- Skipping validations during object construction. 

Although dependency injection (DI) mitigates some of these concerns, not all the fields will be managed by DI.     

Furthermore, `@RequiredArgsConstructor` can obscure which fields are included in the constructor, as Lombok [applies its own logic](https://projectlombok.org/features/constructor) to determine fields to use as constructor arguments.

`@NoArgsConstructor` replaces one line of code with another, making its usefulness questionable. 

**How to manage:**
- Focus on thoughtful object creation design rather than automatically delegating it to Lombok.
- Use `@RequiredArgsConstructor` cautiously, keeping future refactoring and maintainability by other developers in mind.


### `@Data`, `@Setter`, `@Value`, `@Getter`, `@EqualsAndHashCode`

The habitual use of `@Data` and `@Setter` may introduce unnecessary mutability. Listed annotations can also demote the use of [Records](https://docs.oracle.com/en/java/javase/17/language/records.html), both of which can negatively impact the software design.

Besides JPA and some older APIs (such as AWS SDK 1.x), valid cases for mutability are rare. Alternatives to JPA, that work with records —such as [Spring Data JDBC](https://spring.io/projects/spring-data-jdbc)- are worth considering, if extended features of JPA are not required.

When immutability is used, records should be preferred -which cover `@EqualsAndHashCode` and `@ToString` as well- , unless we are working with a pre-Java 16 version.

#### Note About Records

> [Records](https://docs.oracle.com/en/java/javase/17/language/records.html) are not introduced just to provide shorter syntax, but to bring new semantics.

They are named tuples. This brings several benefits:
- True immutability without reflection backdoor.
- Efficient serialization and memory usage, especially in collections and streams.
- Can be used in pattern matching, and more features in the future, like object decomposition, withers etc.

**How to manage:**
- Think twice before using `@Data` or `@Setter`; immutability is often the better design choice, which makes records more suitable.
- For most of the time, records are preferable to these annotations. 

### `@SneakyThrows`

As noted in the [Lombok documentation](https://projectlombok.org/features/SneakyThrows): 

>_"This somewhat contentious ability should be used carefully, of course"._

`@SneakyThrows` should only be used in the cases outlined in the [Lombok documentation](https://projectlombok.org/features/SneakyThrows).

One common misuse is using it to 'convert' checked exceptions into unchecked ones, which it doesn't actually do. Thrown exceptions won't be caught by an upstream `RuntimeException` handler. Even if it were to convert checked exceptions, it cannot be applied to lambdas, where it would be most useful. 

Furthermore, `@SneakyThrows` relies on unspecified JVM behavior to function.

Me, and many software engineers agree that Java would be better without checked exceptions, but `@SneakyThrows` is not the solution for that.

**How to manage:**       
- If it adds value to your project, adhere to the cases outlined in its [documentation](https://projectlombok.org/features/SneakyThrows)


### `@Slf4j`,`@Log4j2`,`@Log` etc.

Since these replace one line of code with another, the productivity gains they offer are debatable.


### Other Annotations

The risks discussed above are based on my on-field experience and often stem from our developer habits. 

Except `@Builder` and `@With` (discussed below), I've rarely come across usage of other Lombok annotations, therefore, I won't draw conclusions about their risks.

Reviewing the [Lombok's documentation](https://projectlombok.org/features/) can be useful to assess their benefits vs. risks.


## `@Builder`, `@With` and Upcoming Java Features

These, in my experience, are useful and safe to use. However, it's worth noting:

- Native withers for records are in development: [JEP-468](https://openjdk.org/jeps/468).
- A common use for `@Builder` is to make constructors with multiple primitive types safer to use. This can also be handled by using custom types for arguments, reducing "primitive obsession". Project Valhalla's [value classes](https://openjdk.org/jeps/401), can promote this approach with offering lightweight objects. This may be more performant approach, reducing the need for builders - perhaps a topic for another article.   


## Hidden Complexity and Debugging Challenges 

Lombok's generated code can complicate debugging, especially when breakpoints are needed in the generated sections. 
Annotations such as `@AllArgsConstructor`, `@Getter` and `@Locked` are common examples where debugging can become more complex.


## Potential Bytecode Manipulation Interference

Lombok and many other libraries and frameworks generates and manipulates the bytecode of class files. These are dependency injection (e.g.Micronout), Hibernate, AOP libraries like AspectJ, circuit breakers like Resilience4j, and monitoring agents like Datadog.

Since version 9, Java (and the bytecode) is evolving fast, requiring byte code manipulation libraries to keep up.  

Rarely, different versions of bytecode manipulation libraries may interfere with each other, or may behind the bytecode version of the compiled class, leading to unpredictable behavior. I've encountered this problem once; an older version of Lombok silently disabled circuit breaker annotations.

The [Class-file API](https://openjdk.org/jeps/457) will provide a standard way to address this. 

**How to handle:**
- Keep Lombok and other dependency versions up to date.
- Test critical functions handled by class file manipulation.


## Future Technical Debt

The Java development team is evolving Java rapidly, yet in a planned, structured way.
We should not assume the features offered by Lombok are not considered by them.
Unlike Kotlin interoperability, compatibility with Lombok is rarely a consideration during Java's development.

Furthermore, Java is not designed to prioritize concise abstractions at the expense of clarity. It was conceived to meet the practical industrial needs in a teamwork. For example, Java records are named tuples, unlike Scala's `Tuple2`, `Tuple3` etc. or Kotlin's `Pair`. 

**How to handle:**
- Keep an eye on future development path of Java.
- Use Lombok with good knowledge and consideration on Java's evolving features and philosophy.


## Conclusion

We might wonder if all these risks mean we should remove Lombok from our projects. Doing so may not necessarily improve design or maintainability of our project.

Many of the mentioned risks stem from our habitual, hurried coding. Concise code may create a sense of cleanliness and improved productivity, but compared to benefits of a good design, this effect is rather small. No automated code generator can provide a good design consistently. 

Lombok provides set annotations, with unrelated purposes and varying usefulness and risks. Therefore, we can utilize Lombok best, when we know it well and consider the risks and benefits in the context of our project and team.
