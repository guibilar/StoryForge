# Implementation Guide

## Design Principles

1. Keep the Core Engine game-agnostic.
2. Business logic belongs in services.
3. GraphQL resolvers should remain thin.
4. Prefer composition over inheritance.
5. Every feature should be independently testable.
6. Avoid circular dependencies.
7. Favor explicit domain models over generic JSON blobs.

---

## Architecture

Backend

Modules

Auth

Campaigns

Characters

Organizations

Locations

Events

Sessions

Relationships

Media

Permissions

Plugin Runtime

---

Frontend

Pages

Dashboard

Campaign

Character

Location

Relationship Graph

Timeline

Map

Settings

Each page owns its own components.

Shared components live under /components.

---

Database

Core tables

users

campaigns

entities

characters

locations

organizations

events

sessions

relationships

notes

assets

tags

Plugin tables are isolated.

Example

vtm_character

vtm_disciplines

vtm_merits

vtm_rituals

No plugin may modify Core tables.

---

GraphQL

Each backend module exposes

Schema

Resolvers

Services

Repository

Tests

Resolvers should never directly access Prisma.

Always use services.

---

Plugin Runtime

Plugins register

Entity types

Relationship types

Event types

Character sheets

Dice engines

Validators

Automation hooks

---

Testing

Every service

Unit tests

Every resolver

Integration tests

Every plugin

Acceptance tests

---

Code Style

Strict TypeScript

No any

ESLint

Prettier

Functional components

No business logic in React components
