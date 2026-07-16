import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "urql";

import { MeDocument } from "../gql/graphql";

export function ProtectedRoute() {
  const [{ data, fetching }] = useQuery({ query: MeDocument });

  if (fetching) {
    return null;
  }

  if (!data?.me) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
