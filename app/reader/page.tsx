import { redirect } from "next/navigation";

export default function LegacyReaderPage() {
  redirect("/interpret");
}
