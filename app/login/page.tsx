import type { Metadata } from "next";

import { AtolLogin } from "@/components/login/login";
import "./login.css";

export const metadata: Metadata = {
  title: "Entrar · Atol",
};

export default function LoginPage() {
  return <AtolLogin />;
}
