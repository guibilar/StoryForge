# AGENTS.md

> Development guide for AI coding agents working on StoryForge.
>
> This document defines the architectural rules, coding conventions, and development workflow. Unless explicitly instructed otherwise by the user, agents should follow these guidelines.

---

# Project Overview

StoryForge is a modular tabletop RPG campaign management platform.

It provides a generic core capable of managing worlds, characters, notes, locations, timelines, items, and projects while allowing RPG systems (Call of Cthulhu, Vampire, D&D, etc.) to extend behavior through a compile-time plugin architecture.

The project follows:

- Domain Driven Design (DDD)
- Clean Architecture
- Event-driven domain model
- GraphQL API
- Prisma ORM
- Compile-time plugin composition
- TypeScript everywhere

---

# Repository Structure

```
storyforge/

apps/
    api/
    web/

packages/
    compiler/
    database/
    domain/
    graphql/
    plugin-sdk/
    shared/
    ui/

plugins/
    coc/
    vampire/
    dnd/

docs/
docker/
scripts/
.github/
```

---

# Core Principles

## 1. Domain First

Everything starts in the domain.

Never expose Prisma models directly.

Never expose database objects directly.

Business logic belongs inside the Domain package.

---

## 2. Infrastructure is replaceable

Database, GraphQL, Web UI and Plugins consume the domain.

The domain should never depend on:

- Prisma
- GraphQL
- Express
- React
- Next.js

---

## 3. Rich Domain Model

Entities contain behavior.

Avoid anemic models.

Prefer

```ts
character.rename(name)
character.moveTo(location)
project.archive()
```

instead of

```ts
character.name = name
```

---

## 4. Explicit Use Cases

Business actions are implemented as Services / Use Cases.

Example

```
CreateProject
UpdateCharacter
CreateLocation
ArchiveWorld
MoveCharacter
```

---

# Packages

## packages/domain

Contains:

- Entities
- Value Objects
- Repositories (interfaces)
- Domain Services
- Events
- Errors

No external dependencies.

---

## packages/database

Contains:

- Prisma
- Repository implementations
- Migrations
- Generated Prisma Client

Never contains business logic.

---

## packages/graphql

Contains

- GraphQL schema generation
- Resolvers
- DataLoaders

No business logic.

Resolvers call services.

---

## packages/compiler

Responsible for compile-time plugin composition.

Responsibilities:

- Discover plugins
- Validate plugins
- Merge GraphQL schema
- Merge Prisma schema fragments
- Merge permissions
- Merge event handlers
- Merge UI extensions
- Generate registries
- Generate TypeScript
- Execute Prisma generation

Runs before build.

No runtime plugin loading.

---

## packages/plugin-sdk

Contains types used by plugins.

Plugins depend on this package.

Core depends only on interfaces.

---

## packages/ui

Shared React components.

Contains:

- Design system
- Tables
- Forms
- Inputs
- Modals
- Layouts

---

## packages/shared

Shared utilities.

Examples:

- Result
- Either
- Date helpers
- IDs
- Logger interfaces

Avoid business logic.

---

# Applications

## apps/api

Responsibilities:

- GraphQL server
- Authentication
- DI container
- Repository wiring
- Event bus
- Service registration

No business logic.

---

## apps/web

Responsibilities:

- React application
- Pages
- UI extension rendering
- GraphQL client

No business logic.

---

# Plugin Architecture

Plugins represent RPG systems only.

Examples

- Call of Cthulhu
- Vampire
- D&D

Plugins cannot modify core features.

Plugins extend the application through predefined extension points.

Plugins contribute:

- Prisma schema fragments
- GraphQL schema
- Event handlers
- Character sheets
- UI tabs
- Sidebar widgets
- Dashboard widgets
- Permissions
- Seed data

---

# UI Extensions

Plugins may contribute UI only through approved extension points.

Examples

```
Character tabs

Inventory tab

Stats tab

Magic tab
```

```
Dashboard widgets

Recent rolls

Sanity tracker

XP tracker
```

```
Sidebar widgets

Session tools

Combat tracker

Investigation clues
```

Plugins cannot replace existing pages.

Plugins cannot alter navigation.

Plugins cannot inject arbitrary React components.

All extensions are registered by the compiler.

---

# Events

Communication between Core and Plugins happens using Domain Events.

Example

```
CharacterCreated
CharacterDeleted
CharacterMoved
SessionStarted
ItemCreated
DiceRolled
```

Core emits events.

Plugins subscribe.

Plugins may emit their own events.

Avoid direct coupling between modules.

---

# Event Rules

Events are immutable.

Example

```ts
interface CharacterCreated {

    characterId: string;

    projectId: string;

    occurredAt: Date;

}
```

Never mutate events.

---

# Repository Rules

Repositories are interfaces.

Example

```ts
interface CharacterRepository {

    save(character: Character)

    findById(id: CharacterId)

}
```

Prisma implementations live inside packages/database.

---

# GraphQL Rules

Resolvers should be thin.

GOOD

```
Resolver

↓

Use Case

↓

Repository

↓

Domain
```

BAD

```
Resolver

↓

Prisma

↓

Business Logic
```

---

# Entity Rules

Entities own state.

Use methods.

Prefer

```ts
character.rename(...)
```

instead of

```ts
character.props.name = ...
```

---

# IDs

Always use Value Objects.

Avoid raw strings.

Example

```ts
CharacterId

ProjectId

WorldId
```

---

# Errors

Use domain errors.

Example

```
CharacterAlreadyExists

WorldArchived

ProjectNotFound

InvalidCharacterName
```

Avoid throwing generic Error.

---

# Result Pattern

Prefer

```ts
Result<T, Error>
```

instead of exceptions for business failures.

---

# Dependency Direction

Allowed

```
Web

↓

GraphQL

↓

Services

↓

Repositories

↓

Database
```

Domain remains independent.

---

# Compiler Workflow

```
Load plugins

↓

Validate manifests

↓

Merge schemas

↓

Merge GraphQL

↓

Merge permissions

↓

Generate registry

↓

Generate Prisma schema

↓

Prisma Generate

↓

Application Build
```

No runtime schema merging.

---

# Naming

Classes

```
Character

Project

Location
```

Interfaces

```
CharacterRepository

PluginDefinition

EventHandler
```

Services

```
CreateCharacterService

DeleteLocationService

ArchiveProjectService
```

Events

```
CharacterCreated

ProjectArchived

DiceRolled
```

---

# Code Style

Prefer composition.

Avoid inheritance unless justified.

Keep functions small.

Prefer immutable data.

Avoid static state.

Use strict TypeScript.

Avoid `any`.

---

# Testing

Write tests for:

- Domain entities
- Value Objects
- Services
- Compiler
- Plugin validation

Mock repositories.

Avoid mocking the domain.

---

# AI Agent Guidelines

When implementing features:

1. Start with the domain.
2. Create Value Objects if necessary.
3. Implement Entity behavior.
4. Define repository interfaces.
5. Implement the service/use case.
6. Add domain events.
7. Implement Prisma repositories.
8. Expose via GraphQL.
9. Render in the web application.
10. Add tests.

Never begin with the database schema unless specifically requested.

---

# Things Agents Must NOT Do

Do NOT:

- Put business logic in GraphQL resolvers.
- Put business logic in React components.
- Make the domain depend on Prisma.
- Use runtime plugin discovery.
- Allow plugins to modify navigation.
- Expose Prisma models outside the database package.
- Bypass services to access repositories directly from GraphQL.
- Use mutable domain events.
- Use raw string IDs.
- Introduce circular dependencies between packages.

---

# Preferred Development Order

For every new feature:

1. Domain
2. Service
3. Repository interface
4. Domain Event
5. Database implementation
6. GraphQL
7. UI
8. Tests

---

# Current Canonical Core Features

The core application currently supports:

- Users
- Projects
- Worlds
- Characters
- Locations
- Items
- Notes

Projects are the top-level container.

Everything belongs to a Project.

---

# Canonical Plugin Scope

Plugins are currently limited to RPG systems.

Examples:

- Call of Cthulhu
- Vampire: The Masquerade
- Dungeons & Dragons

Infrastructure concerns such as logging, search indexing, analytics, notifications, and authentication remain part of the core application and are not implemented as plugins.

---

# Long-Term Goals

The architecture should prioritize:

- Maintainability over short-term speed.
- Explicit dependencies over magic.
- Compile-time validation over runtime failures.
- Strong typing over dynamic behavior.
- Stable extension points over unrestricted customization.
- Domain correctness over ORM convenience.

When in doubt, preserve these principles rather than introducing shortcuts.