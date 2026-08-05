import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Please enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const signUpSchema = signInSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(50, "Name is too long."),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;