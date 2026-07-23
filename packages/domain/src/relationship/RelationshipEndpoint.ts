// Which side of a Relationship is concealed from non-Storyteller viewers
// (KAN-134). `null` on Relationship.ConcealedEndpoint means fully revealed —
// this enum only names the two sides an author can hide.
export enum RelationshipEndpoint {
  SOURCE = "SOURCE",
  TARGET = "TARGET",
}
