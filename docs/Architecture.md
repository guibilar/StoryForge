# Architecture

## Core Rule

The Core Engine never contains game-specific logic.

---

## Layering

React

↓

GraphQL

↓

Services

↓

Repositories

↓

Prisma

↓

PostgreSQL

No layer may skip another.

---

## Entity Ownership

Campaign owns:

Characters

Organizations

Locations

Events

Sessions

Relationships

Notes

Media

Plugins never own campaigns.

---

## Plugins

Plugins may:

Add tables

Register GraphQL extensions

Provide React components

Provide validation

Provide automation

Plugins may NOT:

Modify Core tables

Override authentication

Replace permissions

Modify campaign ownership

---

## Dependency Rule

Core

↓

Plugin Runtime

↓

Plugins

Plugins must never depend on one another.

---

## Philosophy

Story data is permanent.

Rules are replaceable.

The campaign should survive switching from one plugin version to another.
