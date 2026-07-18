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
import styles from "./AuthPage.module.css";

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
    <main className={styles.auth}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img className={styles.mark} src="/favicon.svg" alt="" />
          <span className={styles.wordmark}>
            Story<b>Forge</b>
          </span>
        </div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>
          Start building worlds, sessions, and story.
        </p>
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
          <Button type="submit" disabled={fetching} style={{ width: "100%" }}>
            {fetching ? "Creating account…" : "Create account"}
          </Button>
        </Form>
        <p className={styles.switch}>
          Already have an account?{" "}
          <Link as={RouterLink} to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
