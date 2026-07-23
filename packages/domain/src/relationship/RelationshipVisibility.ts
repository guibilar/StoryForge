export enum RelationshipVisibility {
  // Everyone who can see both endpoint entities. Still subject to that
  // endpoint rule — this level widens nothing on its own.
  PUBLIC = "PUBLIC",
  // The Storyteller side only, regardless of how public the endpoints are.
  STORYTELLER = "STORYTELLER",
  // The Storyteller side plus the specific players named as recipients.
  TARGETED = "TARGETED",
}
