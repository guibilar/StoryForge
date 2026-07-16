import type { FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation } from "urql";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Link,
} from "@storyforge/ui";

import { RegisterDocument } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";

export function RegisterPage() {
  const navigate = useNavigate();
  const [{ error, fetching }, register] = useMutation(RegisterDocument);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const result = await register({
      input: {
        email: String(form.get("email")),
        password: String(form.get("password")),
      },
    });

    if (result.data?.registerUser) {
      navigate("/dashboard");
    }
  }

  return (
    <main>
      <h1>Register</h1>
      <Form onSubmit={handleSubmit}>
        <FormError>{formatGraphQLError(error)}</FormError>
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </FormField>
        <Button type="submit" disabled={fetching}>
          Register
        </Button>
      </Form>
      <p>
        Already have an account?{" "}
        <Link as={RouterLink} to="/login">
          Log in
        </Link>
      </p>
    </main>
  );
}
