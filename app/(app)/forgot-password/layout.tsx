import { WithFullkodCredit } from "@/components/FullkodCredit";

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WithFullkodCredit pinned>{children}</WithFullkodCredit>;
}
