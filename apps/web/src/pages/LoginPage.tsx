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

import { LoginDocument } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./AuthPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [{ error, fetching }, login] = useMutation(LoginDocument);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const result = await login({
      input: {
        email: String(form.get("email")),
        password: String(form.get("password")),
      },
    });

    if (result.data?.login) {
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
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to open your campaigns.</p>
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
              autoComplete="current-password"
              required
            />
          </FormField>
          <Button type="submit" disabled={fetching} style={{ width: "100%" }}>
            {fetching ? "Signing in…" : "Sign in"}
          </Button>
        </Form>
        <p className={styles.switch}>
          Need an account?{" "}
          <Link as={RouterLink} to="/register">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
