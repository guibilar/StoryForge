import { Button, Form, FormField, Input } from "@storyforge/ui";

export function LoginPage() {
  return (
    <main>
      <h1>Log in</h1>
      <Form
        onSubmit={
          (event) =>
            event.preventDefault() /* TODO(KAN-31): wire login mutation */
        }
      >
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
        <Button type="submit">Log in</Button>
      </Form>
    </main>
  );
}
