import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

const policyCategories = [
  {
    title: 'Customer Service',
    items: ['Refund Policy', 'Compensation', 'Complaint Resolution', 'Escalation Matrix', 'Customer Satisfaction']
  },
  {
    title: 'Food Safety',
    items: ['Food Allergies', 'Cross Contamination', 'Food Temperature', 'Expired Food', 'Food Poisoning Procedure']
  },
  {
    title: 'Restaurant Operations',
    items: ['Delivery Zones', 'Delivery Delays', 'Pickup Orders', 'Reservation Policy', 'Kitchen Delays', 'Closing Hours']
  },
  {
    title: 'Payments',
    items: ['Refund Rules', 'Payment Failure', 'Voucher Policies', 'Promo Codes', 'Gift Cards']
  },
  {
    title: 'AI & Automation',
    items: ['Brand Voice', 'AI Confidence Rules', 'Restricted Responses', 'Sensitive Topics', 'AI Knowledge Base']
  },
  {
    title: 'Legal & Compliance',
    items: ['GDPR', 'Customer Privacy', 'Data Retention', 'Security', 'Consent']
  }
];

const policySeed = [
  {
    id: 1,
    title: 'Refund & Compensation',
    category: 'Customer Service',
    department: 'Support Ops',
    priority: 'Critical',
    status: 'Published',
    branchScope: 'All branches',
    version: 'v4.2',
    owner: 'Mina Chen',
    aiEnabled: true,
    lastUpdated: '2h ago',
    usageCount: '1.2k',
    approval: 'Approved',
    description: 'Covers refund eligibility, compensation tiers, and escalation thresholds for guest recovery workflows.',
    tags: ['refund', 'compensation', 'guest recovery'],
    effectiveDate: '2026-01-15',
    expiry: 'No expiry',
    summary: 'Requires manager review for amounts above $50 and mandates a goodwill voucher when service failures are confirmed.',
    aiInstructions: 'Prioritize empathy, confirm order details, and never promise reimbursements without evidence.'
  },
  {
    id: 2,
    title: 'Food Allergy Handling',
    category: 'Food Safety',
    department: 'Kitchen',
    priority: 'Critical',
    status: 'Review',
    branchScope: 'North & East',
    version: 'v3.1',
    owner: 'Asha Patel',
    aiEnabled: true,
    lastUpdated: '1d ago',
    usageCount: '842',
    approval: 'Pending',
    description: 'Defines allergen verification steps, kitchen notification, and customer warning language for food safety incidents.',
    tags: ['allergy', 'kitchen', 'medical'],
    effectiveDate: '2026-02-01',
    expiry: 'No expiry',
    summary: 'Requires explicit customer confirmation and a supervisor handoff for any allergy-related incident.',
    aiInstructions: 'Always ask for the allergen and advise the customer that the kitchen must be notified immediately.'
  },
  {
    id: 3,
    title: 'Delivery Delay Escalation',
    category: 'Restaurant Operations',
    department: 'Operations',
    priority: 'High',
    status: 'Draft',
    branchScope: 'Downtown',
    version: 'v2.5',
    owner: 'Jordan Lee',
    aiEnabled: false,
    lastUpdated: '3d ago',
    usageCount: '510',
    approval: 'Draft',
    description: 'Orchestrates policies for late deliveries, weather delays, and order rerouting decisions.',
    tags: ['delivery', 'delay', 'weather'],
    effectiveDate: '2026-03-20',
    expiry: '2027-03-20',
    summary: 'Customers receive a proactive update after 20 minutes and may receive a partial refund for severe delays.',
    aiInstructions: 'Keep the response concise, transparent, and ready to hand off to a manager when the delay exceeds 35 minutes.'
  },
  {
    id: 4,
    title: 'Payment Failure Recovery',
    category: 'Payments',
    department: 'Finance',
    priority: 'High',
    status: 'Published',
    branchScope: 'All branches',
    version: 'v1.9',
    owner: 'Nadia Brooks',
    aiEnabled: true,
    lastUpdated: '5h ago',
    usageCount: '633',
    approval: 'Approved',
    description: 'Standardizes recovery steps for failed card payments, wallet issues, and voucher usage disputes.',
    tags: ['payments', 'card', 'recovery'],
    effectiveDate: '2026-04-03',
    expiry: 'No expiry',
    summary: 'Supports retry attempts, manual override approval, and temporary store credit when the charge is disputed.',
    aiInstructions: 'Ask for the last four digits of the payment method and avoid suggesting a refund until the charge status is validated.'
  },
  {
    id: 5,
    title: 'AI Brand Voice Rules',
    category: 'AI & Automation',
    department: 'Product',
    priority: 'Medium',
    status: 'Published',
    branchScope: 'All branches',
    version: 'v5.0',
    owner: 'Luca Cruz',
    aiEnabled: true,
    lastUpdated: '1w ago',
    usageCount: '2.3k',
    approval: 'Approved',
    description: 'Defines the tone, confidence thresholds, and restricted responses for every AI support interaction.',
    tags: ['ai', 'brand', 'tone'],
    effectiveDate: '2026-05-10',
    expiry: 'No expiry',
    summary: 'AI must stay empathetic, concise, and avoid making promises about food quality or refunds without policy support.',
    aiInstructions: 'Use calm, human-centered language and escalate to a human when the customer expresses urgency or distress.'
  },
  {
    id: 6,
    title: 'Customer Privacy & Consent',
    category: 'Legal & Compliance',
    department: 'Legal',
    priority: 'Critical',
    status: 'Review',
    branchScope: 'All branches',
    version: 'v2.8',
    owner: 'Priya Singh',
    aiEnabled: false,
    lastUpdated: '2d ago',
    usageCount: '289',
    approval: 'Pending',
    description: 'Covers consent capture, data retention, account deletion requests, and privacy notice handling.',
    tags: ['privacy', 'consent', 'gdpr'],
    effectiveDate: '2026-06-01',
    expiry: 'No expiry',
    summary: 'Requires written consent before storing or sharing sensitive customer contact data outside the support platform.',
    aiInstructions: 'Never request or expose customer sensitive data beyond what is necessary for the current support task.'
  }
];

const statusClasses = {
  Published: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25',
  Review: 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25',
  Draft: 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20',
  Archived: 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/25'
};

const priorityClasses = {
  Critical: 'text-rose-600',
  High: 'text-amber-600',
  Medium: 'text-sky-600',
  Low: 'text-emerald-600'
};

function PolicyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [selectedPolicy, setSelectedPolicy] = useState(policySeed[0]);
  const [activeTab, setActiveTab] = useState('Overview');

  const filteredPolicies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return policySeed.filter((policy) => {
      const matchesCategory = selectedCategory === 'All' || policy.category === selectedCategory;
      const matchesStatus = statusFilter === 'All' || policy.status === statusFilter;
      const matchesBranch = branchFilter === 'All' || policy.branchScope === branchFilter;
      const matchesDepartment = departmentFilter === 'All' || policy.department === departmentFilter;
      const matchesPriority = priorityFilter === 'All' || policy.priority === priorityFilter;
      const haystack = [policy.title, policy.description, policy.category, policy.department, policy.tags.join(' '), policy.summary]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);

      return matchesCategory && matchesStatus && matchesBranch && matchesDepartment && matchesPriority && matchesSearch;
    });
  }, [searchQuery, selectedCategory, statusFilter, branchFilter, departmentFilter, priorityFilter]);

  const metrics = useMemo(() => [
    { label: 'Total Policies', value: policySeed.length, tone: 'from-slate-900 to-slate-700' },
    { label: 'Published', value: policySeed.filter((item) => item.status === 'Published').length, tone: 'from-emerald-600 to-teal-500' },
    { label: 'Pending Review', value: policySeed.filter((item) => item.status === 'Review').length, tone: 'from-amber-500 to-orange-500' },
    { label: 'AI Enabled', value: policySeed.filter((item) => item.aiEnabled).length, tone: 'from-violet-600 to-fuchsia-500' }
  ], []);

  const visiblePolicies = filteredPolicies.length > 0 ? filteredPolicies : [];

  const summaryTabs = ['Overview', 'Conditions', 'AI Instructions', 'Escalation'];

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.15),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.14),_transparent_35%)]">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
            <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Operational policy intelligence
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Policies Center</h1>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                    Manage every operational, customer service, compliance, food safety, and AI policy from one central location.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    + New Policy
                  </button>
                  <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Import Policies
                  </button>
                  <button className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-900">
                    Export
                  </button>
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_45px_-24px_rgba(15,23,42,0.32)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Categories</p>
                  <button className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    Collapse
                  </button>
                </div>
                <div className="space-y-4">
                  {policyCategories.map((group) => (
                    <div key={group.title}>
                      <button
                        onClick={() => setSelectedCategory(group.title)}
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${selectedCategory === group.title ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                        <span>{group.title}</span>
                        <span className={`text-xs ${selectedCategory === group.title ? 'text-slate-200 dark:text-slate-600' : 'text-slate-400'}`}>
                          {group.items.length}
                        </span>
                      </button>
                      {selectedCategory === group.title ? (
                        <div className="mt-2 space-y-1.5 pl-2">
                          {group.items.map((item) => (
                            <button
                              key={item}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                              <span>{item}</span>
                              <span className="text-[11px] text-slate-400">→</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </aside>

              <div className="space-y-6">
                <section className="rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_45px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative flex-1">
                      <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.9 3.6l4.7 4.7-1.4 1.4-4.7-4.7A6 6 0 012 8z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search policies, keywords, AI instructions, and tags"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-12 pr-4 text-sm font-medium text-slate-700 shadow-inner outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <option value="All">Status</option>
                        <option value="Published">Published</option>
                        <option value="Review">Review</option>
                        <option value="Draft">Draft</option>
                      </select>
                      <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <option value="All">Branch</option>
                        <option value="All branches">All branches</option>
                        <option value="North & East">North & East</option>
                        <option value="Downtown">Downtown</option>
                      </select>
                      <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <option value="All">Priority</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {metrics.map((metric) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`rounded-[24px] border border-slate-200/80 bg-gradient-to-br ${metric.tone} p-[1px] shadow-[0_20px_45px_-24px_rgba(15,23,42,0.4)]`}
                    >
                      <div className="rounded-[23px] bg-white/90 p-4 backdrop-blur dark:bg-slate-900/90">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{metric.label}</p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{metric.value}</p>
                      </div>
                    </motion.div>
                  ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  {visiblePolicies.length > 0 ? (
                    visiblePolicies.map((policy) => (
                      <motion.button
                        key={policy.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setSelectedPolicy(policy)}
                        className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 text-left shadow-[0_20px_50px_-24px_rgba(15,23,42,0.3)] transition-all hover:-translate-y-1 hover:shadow-[0_28px_65px_-24px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-900/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{policy.category}</p>
                            <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{policy.title}</h3>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[policy.status] || 'bg-slate-100 text-slate-700'}`}>
                            {policy.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{policy.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses[policy.priority] || 'text-slate-600'} border-slate-200 dark:border-slate-700`}>
                            {policy.priority}
                          </span>
                          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            {policy.department}
                          </span>
                          {policy.aiEnabled ? (
                            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300">
                              AI Enabled
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                          <span>Owner: {policy.owner}</span>
                          <span>Version: {policy.version}</span>
                          <span>Updated: {policy.lastUpdated}</span>
                        </div>
                      </motion.button>
                    ))
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-12 text-center text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 xl:col-span-2">
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">No policies match the current filters.</p>
                      <p className="mt-2 text-sm">Try broadening the search or switching to a different category.</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>

      {selectedPolicy ? (
        <motion.aside
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.24 }}
          className="fixed right-0 top-0 z-[70] hidden h-screen w-[420px] flex-col border-l border-slate-200 bg-white/95 p-5 shadow-[0_20px_80px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:flex"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Policy detail</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{selectedPolicy.title}</h2>
            </div>
            <button onClick={() => setSelectedPolicy(null)} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {summaryTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${activeTab === tab ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Purpose</p>
            <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{selectedPolicy.summary}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Applies To</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedPolicy.branchScope}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Effective Date</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedPolicy.effectiveDate}</p>
            </div>
          </div>

          <div className="mt-5 flex-1 overflow-y-auto pr-1">
            {activeTab === 'Overview' ? (
              <div className="space-y-3">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Policy overview</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{selectedPolicy.description}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Required actions</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <li>• Confirm customer details before approving compensation.</li>
                    <li>• Capture evidence and attach the case reference.</li>
                    <li>• Escalate to a supervisor if the case exceeds the approved threshold.</li>
                  </ul>
                </div>
              </div>
            ) : null}

            {activeTab === 'Conditions' ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">When this policy applies</p>
                <p className="mt-2">The policy is triggered when a customer reports a delayed order, food quality concern, or service failure that requires a recovery decision.</p>
              </div>
            ) : null}

            {activeTab === 'AI Instructions' ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">AI guidance</p>
                <p className="mt-2">{selectedPolicy.aiInstructions}</p>
              </div>
            ) : null}

            {activeTab === 'Escalation' ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">Escalation rules</p>
                <p className="mt-2">Escalate when high-risk complaints involve allergy exposure, payment disputes, or repeated service failures.</p>
              </div>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </div>
  );
}

export default PolicyPage;
