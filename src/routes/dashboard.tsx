import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, AlertTriangle, FileText, IndianRupee, TrendingUp, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";

export const Route = createFileRoute("/dashboard")({
  component: () => <ProtectedRoute><Dashboard /></ProtectedRoute>,
});

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, matched: 0, mismatched: 0, missing: 0, flagged: 0, totalTax: 0, totalAmount: 0 });
  const [byMonth, setByMonth] = useState<any[]>([]);
  const [byVendor, setByVendor] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: invs } = await supabase.from("invoices").select("*").eq("user_id", user.id);
      if (!invs) return;
      const s = { total: invs.length, matched: 0, mismatched: 0, missing: 0, flagged: 0, totalTax: 0, totalAmount: 0 };
      const monthMap: Record<string, { month: string; cgst: number; sgst: number; igst: number }> = {};
      const vendorMap: Record<string, number> = {};
      for (const i of invs) {
        if (i.status === "matched") s.matched++;
        else if (i.status === "mismatched") s.mismatched++;
        else if (i.status === "missing") s.missing++;
        else if (i.status === "flagged") s.flagged++;
        s.totalTax += Number(i.cgst || 0) + Number(i.sgst || 0) + Number(i.igst || 0);
        s.totalAmount += Number(i.total_amount || 0);
        if (i.invoice_date) {
          const m = i.invoice_date.slice(0, 7);
          monthMap[m] = monthMap[m] || { month: m, cgst: 0, sgst: 0, igst: 0 };
          monthMap[m].cgst += Number(i.cgst || 0);
          monthMap[m].sgst += Number(i.sgst || 0);
          monthMap[m].igst += Number(i.igst || 0);
        }
        const vn = i.vendor_name || "Unknown";
        vendorMap[vn] = (vendorMap[vn] || 0) + Number(i.total_amount || 0);
      }
      setStats(s);
      setByMonth(Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)));
      setByVendor(Object.entries(vendorMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })));
    })();
  }, [user]);

  const complianceScore = stats.total ? Math.round((stats.matched / stats.total) * 100) : 0;
  const pieData = [
    { name: "Matched", value: stats.matched, color: "var(--success)" },
    { name: "Mismatched", value: stats.mismatched, color: "var(--warning)" },
    { name: "Missing", value: stats.missing, color: "var(--destructive)" },
    { name: "Flagged", value: stats.flagged, color: "var(--saffron)" },
  ].filter(d => d.value > 0);

  return (
    <AppLayout title="Dashboard" subtitle="Your GST compliance at a glance">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Compliance score" value={`${complianceScore}%`} icon={ShieldAlert} accent="primary" sub={`${stats.matched}/${stats.total} matched`} />
        <Stat label="Total invoices" value={stats.total.toString()} icon={FileText} accent="teal" />
        <Stat label="Total billed" value={inr(stats.totalAmount)} icon={IndianRupee} accent="saffron" />
        <Stat label="Total tax" value={inr(stats.totalTax)} icon={TrendingUp} accent="success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card border rounded-2xl p-5 shadow-card">
          <h3 className="font-semibold mb-1">Tax trend by month</h3>
          <p className="text-xs text-muted-foreground mb-4">CGST · SGST · IGST</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => inr(Number(v))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cgst" stackId="a" fill="var(--primary)" radius={[0,0,0,0]} />
                <Bar dataKey="sgst" stackId="a" fill="var(--teal)" radius={[0,0,0,0]} />
                <Bar dataKey="igst" stackId="a" fill="var(--saffron)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <h3 className="font-semibold mb-1">Reconciliation status</h3>
          <p className="text-xs text-muted-foreground mb-4">Matched vs flagged</p>
          <div className="h-64">
            {pieData.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full grid place-items-center text-sm text-muted-foreground">No data yet</div>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <h3 className="font-semibold mb-4">Top vendors by spend</h3>
          <div className="space-y-3">
            {byVendor.map((v, i) => (
              <div key={v.name} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md bg-primary/10 text-primary grid place-items-center text-xs font-bold">{i+1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{v.name}</div>
                  <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                    <div className="h-full gradient-primary" style={{ width: `${(v.value / (byVendor[0]?.value || 1)) * 100}%` }} />
                  </div>
                </div>
                <div className="text-sm font-mono text-muted-foreground">{inr(v.value)}</div>
              </div>
            ))}
            {!byVendor.length && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <h3 className="font-semibold mb-4">Quick health</h3>
          <div className="space-y-3">
            <Health icon={CheckCircle2} text={`${stats.matched} invoices reconciled with GSTR-2B`} tone="success" />
            <Health icon={AlertTriangle} text={`${stats.mismatched} amount mismatches need review`} tone="warning" />
            <Health icon={ShieldAlert} text={`${stats.flagged} flagged for fraud signals`} tone="destructive" />
            <Health icon={FileText} text={`${stats.missing} invoices not found in GSTR-2B`} tone="info" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, icon: Icon, accent, sub }: { label: string; value: string; icon: any; accent: "primary"|"teal"|"saffron"|"success"; sub?: string }) {
  const cls = {
    primary: "from-primary/15 to-primary/5 text-primary",
    teal: "from-teal/15 to-teal/5 text-teal",
    saffron: "from-saffron/15 to-saffron/5 text-saffron",
    success: "from-success/15 to-success/5 text-success",
  }[accent];
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-lg bg-gradient-to-br grid place-items-center ${cls}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function Health({ icon: Icon, text, tone }: { icon: any; text: string; tone: "success"|"warning"|"destructive"|"info" }) {
  const c = { success: "text-success bg-success/10", warning: "text-warning bg-warning/10", destructive: "text-destructive bg-destructive/10", info: "text-primary bg-primary/10" }[tone];
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div className={`h-8 w-8 rounded-lg grid place-items-center ${c}`}><Icon className="h-4 w-4" /></div>
      <div className="text-sm">{text}</div>
    </div>
  );
}
