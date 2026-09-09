import { db } from "@/lib/db";
import WithdrawalTable from "./withdrawal-table";

export default async function AdminWithdrawalsPage() {
  const withdrawals = await db.withdrawal.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { requestedAt: "asc" },
    include: { user: { select: { fullName: true, email: true } } },
    take: 100,
  });

  const rows = withdrawals.map((w) => ({
    id: w.id,
    name: w.user.fullName,
    email: w.user.email,
    amountKobo: w.amountKobo,
    bankCode: w.destinationBankCode,
    accountNumber: w.destinationAccountNumber,
    requestedAt: w.requestedAt.toISOString(),
    status: w.status,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Withdrawals</h1>
      <p className="mt-1 text-sm text-white/50">
        Provider withdrawal requests. Mark a transfer complete once it&apos;s sent, or fail it to return funds to the provider&apos;s balance.
      </p>
      <WithdrawalTable rows={rows} />
    </div>
  );
}
