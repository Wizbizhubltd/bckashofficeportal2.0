import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { PrinterIcon } from 'lucide-react';
import {
  clientsApi,
  GROUP_ROLE_LABELS,
  type ClientContact,
  type ClientDetail,
  type ClientGroupMembership,
  type ClientLoan,
  type ClientLoanForm,
} from '../../../api/clientsApi';
import { PassportPhoto } from '../../../components/PassportPhoto';
import { Logo } from '../../../components/Logo';
import { formatMoney } from '../../../utils/money';
import { clientName, formatDate } from './ClientDetailPage';

/** The tenures (in weeks) offered on the paper form's "Tick Tenure" row. */
const TENURE_WEEKS = [12, 16, 20, 21, 22, 24];

/** Group roles in the order the group guarantor's form lists them. */
const ROLE_ORDER = ['leader', 'assistant', 'organizer', 'member'];

const EMPTY_LOAN_FORM: ClientLoanForm = {
  staffName: null,
  proposedLoanAmount: null,
  loanTerm: null,
  loanTermType: null,
  loanProductName: null,
  nin: null,
  formFee: null,
  groupId: null,
  groupName: null,
  groupMembers: [],
};

const NEW_PAGE: CSSProperties = { breakBefore: 'page' };

interface Guarantor extends ClientContact {
  photoUrl: string | null;
}

/**
 * A client's data page and the society's membership/loan acceptance form (conditions, declarations,
 * guarantor and group guarantor forms, the membership agreement and the reference form), laid out for
 * printing on A4 — opened in its own tab from the client page, with no portal chrome. Everything is
 * filled from the client's record as it is now, so edits to the profile show on the next print. Opens
 * the print dialog once everything has loaded.
 */
export function ClientPrintPage() {
  const clientId = Number(useParams<{ id: string }>().id);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [groups, setGroups] = useState<ClientGroupMembership[]>([]);
  const [loans, setLoans] = useState<ClientLoan[]>([]);
  const [loanForm, setLoanForm] = useState<ClientLoanForm>(EMPTY_LOAN_FORM);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [references, setReferences] = useState<ClientContact[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const photoUrls: string[] = [];
    // Guarantor photos are fetched before the page renders, so they're in place when the print dialog opens.
    const loadGuarantors = async (): Promise<Guarantor[]> => {
      const list = await clientsApi.contacts(clientId, 'guarantors').catch(() => [] as ClientContact[]);
      return Promise.all(
        list.map(async (g) => {
          const photoUrl = g.hasPhoto ? await clientsApi.contactPhotoUrl(clientId, 'guarantors', g.id) : null;
          if (photoUrl) photoUrls.push(photoUrl);
          return { ...g, photoUrl };
        }),
      );
    };

    Promise.all([
      clientsApi.get(clientId),
      clientsApi.groups(clientId).catch(() => []),
      clientsApi.loans(clientId).then((r) => r.items).catch(() => []),
      clientsApi.loanForm(clientId).catch(() => EMPTY_LOAN_FORM),
      loadGuarantors(),
      clientsApi.contacts(clientId, 'references').catch(() => []),
    ])
      .then(([c, g, l, f, gs, rs]) => {
        setClient(c);
        setGroups(g);
        setLoans(l);
        setLoanForm(f);
        setGuarantors(gs);
        setReferences(rs);
        document.title = `${clientName(c)} — client data`;
        // Give the photo a moment to load before the print dialog opens.
        setTimeout(() => window.print(), 800);
      })
      .catch(() => setFailed(true));

    return () => photoUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [clientId]);

  if (failed) return <p className="p-10 text-center text-gray-500">This client couldn't be loaded.</p>;
  if (!client) return <p className="p-10 text-center text-gray-400">Preparing the data page…</p>;

  const name = clientName(client);
  const society = client.officeName || 'BC KASH';
  const staffName = client.staffName ?? loanForm.staffName ?? client.createdByName;
  const residentialAddress = [client.address, client.street, client.city, client.state, client.country].filter(Boolean).join(', ');
  const groupName = loanForm.groupName ?? groups[0]?.groupName ?? null;
  const tenureWeeks = loanForm.loanTermType === 'Weeks' ? loanForm.loanTerm : null;
  const reference = references[0] ?? null;
  const age = ageFrom(client.dob);
  const leader = loanForm.groupMembers.find((m) => m.role === 'leader')?.name ?? null;

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-heading font-bold text-white hover:bg-primary/90">
          <PrinterIcon size={16} /> Print
        </button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white p-[15mm] text-[13px] text-gray-800 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-center justify-between border-b-2 border-primary pb-4">
          <div className="rounded bg-primary px-3 py-2">
            <Logo width={120} height={40} />
          </div>
          <div className="text-right">
            <h1 className="font-heading text-lg font-bold text-primary">Client Data Page</h1>
            <p className="text-xs font-bold uppercase text-gray-600">{society}</p>
            <p className="text-xs text-gray-500">Printed {formatDate(new Date().toISOString(), true)}</p>
          </div>
        </header>

        <h2 className="mt-4 text-center font-heading text-xl text-sky-600">MEMBERSHIP/LOAN ACCEPTANCE FORM</h2>

        <section className="mt-6 flex gap-6">
          <PassportPhoto clientId={client.id} name={name} hasPhoto={client.hasPhoto} className="h-[45mm] w-[35mm]" />
          <div className="flex-1">
            <h2 className="font-heading text-xl font-bold">{name}</h2>
            <p className="text-gray-500">Account No. {client.accountNo ?? '—'}</p>
            <table className="mt-3 w-full">
              <tbody>
                <Row label="Status" value={`${client.status}${client.isHighRisk ? ' · HIGH RISK' : ''}`} />
                <Row label="Branch" value={client.officeName} />
                <Row label="Staff" value={staffName} />
                <Row label="Registration date" value={formatDate(client.joinedDate ?? client.createdAt)} />
                <Row label="Onboarded by" value={client.createdByName} />
                <Row label="Approved" value={client.activatedDate ? `${formatDate(client.activatedDate)} by ${client.activatedByName ?? '—'}` : 'Not yet'} />
              </tbody>
            </table>
          </div>
        </section>

        <Section title="Personal details">
          <Row label="First name" value={client.firstName} />
          <Row label="Middle name" value={client.middleName} />
          <Row label="Last name" value={client.lastName} />
          <Row label="External ID" value={client.externalId} />
          <Row label="Gender" value={client.gender} />
          <Row label="Date of birth" value={client.dob ? formatDate(client.dob) : null} />
          <Row label="Marital status" value={client.maritalStatus} />
          <Row label="Nationality" value={client.nationality} />
          <Row label="Occupation / type of business" value={client.occupation} />
          <Row label="Mobile" value={client.mobile} />
          <Row label="Phone" value={client.phone ?? client.mobile} />
          <Row label="Email" value={client.email} />
          <Row label="Residential address" value={residentialAddress} />
          <Row label="Business address" value={client.businessAddress} />
          <Row label="NIN" value={loanForm.nin} />
        </Section>

        <Section title="BVN verification">
          <Row label="BVN" value={client.bvn} />
          <Row label="Verified" value={client.bvnVerifiedAt ? formatDate(client.bvnVerifiedAt, true) : 'Not verified'} />
          <Row label="Details on file" value={client.bvnDetailsSource === 'client' ? "Client's own (differ from BVN)" : client.bvnDetailsSource === 'bvn' ? 'From BVN record' : null} />
          {client.highRiskReason && <Row label="High-risk reason" value={client.highRiskReason} />}
          {client.highRiskClearedAt && <Row label="Marked safe" value={`${formatDate(client.highRiskClearedAt)}${client.highRiskClearedNote ? ` — ${client.highRiskClearedNote}` : ''}`} />}
        </Section>

        <Section title="Groups">
          {groups.length === 0 ? (
            <Row label="—" value="Not in any group (N/A)" />
          ) : (
            groups.map((g) => <Row key={g.groupId} label={g.groupName ?? `Group #${g.groupId}`} value={`${GROUP_ROLE_LABELS[g.role ?? 'member'] ?? 'Member'} · ${g.status}`} />)
          )}
        </Section>

        <section className="mt-6 break-inside-avoid">
          <Heading>Proposed loan</Heading>
          <table className="w-full">
            <tbody>
              <Row label="Proposed loan" value={loanForm.proposedLoanAmount === null ? null : formatMoney(loanForm.proposedLoanAmount)} />
              <Row label="Loan product" value={loanForm.loanProductName} />
              <Row label="Tenure" value={loanForm.loanTerm ? `${loanForm.loanTerm} ${(loanForm.loanTermType ?? '').toLowerCase()}` : null} />
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="font-bold">Tick Tenure</span>
            {TENURE_WEEKS.map((weeks) => (
              <span key={weeks} className="inline-flex items-center gap-2">
                {weeks}
                <span className="inline-flex h-5 w-16 items-center justify-center border border-gray-500 text-xs font-bold">{tenureWeeks === weeks ? '✓' : ''}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="mt-6 break-inside-avoid">
          <Heading>Loan record</Heading>
          {loans.length === 0 ? (
            <p className="text-gray-500">No loans on record.</p>
          ) : (
            <table className="w-full">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-1">Loan</th>
                  <th className="py-1 text-right">Requested</th>
                  <th className="py-1 text-right">Approved</th>
                  <th className="py-1 pl-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loans.map((loan) => (
                  <tr key={loan.id}>
                    <td className="py-1">{loan.accountNumber ?? `#${loan.id}`}</td>
                    <td className="py-1 text-right">{formatMoney(loan.appliedAmount)}</td>
                    <td className="py-1 text-right">{loan.approvedAmount === null ? '—' : formatMoney(loan.approvedAmount)}</td>
                    <td className="py-1 pl-4">{loan.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-6">
          <Heading>Guarantors</Heading>
          {guarantors.length === 0 ? (
            <p className="text-gray-500">No guarantors on record.</p>
          ) : (
            guarantors.map((g, index) => (
              <div key={g.id} className="mb-4 flex break-inside-avoid gap-6 border-b border-gray-100 pb-4 last:border-0">
                <div className="flex-1">
                  <p className="mb-1 font-heading font-bold">Guarantor {index + 1}</p>
                  <table className="w-full">
                    <tbody>
                      <Row label="Name" value={g.fullName} />
                      <Row label="Mobile" value={g.phone} />
                      <Row label="Relationship" value={g.relationship} />
                      <Row label="Gender" value={g.gender} />
                      <Row label="Address" value={g.address} />
                      <Row label="Note (business address, occupation / type of business)" value={g.occupation} />
                    </tbody>
                  </table>
                </div>
                <div className="text-center text-xs text-gray-500">
                  <p className="mb-1">Guarantor {index + 1} Passport</p>
                  {g.photoUrl ? (
                    <img src={g.photoUrl} alt={`Passport photograph of ${g.fullName}`} className="h-[35mm] w-[28mm] rounded border border-gray-200 object-cover" />
                  ) : (
                    <div className="flex h-[35mm] w-[28mm] items-center justify-center rounded border border-dashed border-gray-300">Affix photo</div>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        <footer className="mt-10 grid grid-cols-2 gap-10 text-xs text-gray-500">
          <div className="border-t border-gray-300 pt-2">Client's signature & date</div>
          <div className="border-t border-gray-300 pt-2">Officer's signature & date</div>
        </footer>

        {/* Conditions and the borrower's declaration */}
        <section style={NEW_PAGE} className="pt-2">
          <h2 className="mb-3 text-center font-heading text-lg">
            Conditions for taking <span className="font-bold">{society}.</span>
          </h2>
          <ol className="list-decimal space-y-1 pl-5 text-justify text-[12px] leading-snug">
            <li>
              Deposit: Members are expected to deposit 35% of the loan amount they intend to take before collecting the loan or make six weeks payment after collecting
              the loan as deposit before commencement of the repayment of the loan. Members who make lump sum deposit will not be required to pay the six deposit
              installments. All deposit/savings will be repaid after the last person in the group has finished paying the loan collected NOTE: (Everybody's loan must be
              completed)
            </li>
            <li>
              Any breach of contract i.e. the tenure and required weekly payment etc. will attract a non-membership interest of 13% of the loan principal added to the
              agreed payment. This holds provided that the so called breach is within the life (tenure) of the loan. On Expiration, every outstanding amount shall attract
              a monthly interest of 5% which falls due on the next day of the month when the contract was consummated. NOTE: any breach of renewal attract a
              non-membership interest of 10% of the amount of loan. <strong>{society}</strong> considers those loan seekers who do not abide by the society's rule as
              non-members and therefore charges them a different interest from the one charged our members.
            </li>
            <li>Any default in payment for a week shall attract an interest of 2% of the principal.</li>
            <li>
              Where the default in weekly payment exceeds two weeks, the society shall issue a DEMAND NOTICE for the total sum owed to the defaulting member and
              guarantor, the demand notice shall give the defaulting member and guarantor 3 days to comply.
            </li>
            <li>
              A member cannot collect more than one loan at a time nor belong to more than one group nor use other persons to collect loan. A breach of these conditions
              is considered fraud and will lead to immediate termination of contract. The society will take reasonable actions against the member(s) involved and may
              also have offenders prosecuted.
            </li>
            <li>
              Upon signing this form, the loan seekers/members shall upon confirmation of the collateral(s)/article of trade by the society, submit a list of valuable
              collateral(s)/article of trade to cover the loan sum and shall give the society, the right to take possession of the listed collateral(s)/article on
              default of repayment of the amount stated in the demand notice, to sell and recover the principal and accrued interest.
            </li>
            <li>
              The member hereby grants express permission to the society, to enter upon his/her premise to take actual possession of the collateral(s)/article of trade
              stated in the list, and same does not amount to trespass. The member is to counter sign confirming the collateral(s)/article of trade in the possession of
              the society.
            </li>
            <li>
              The society shall after 3 days of taking possession of the collateral(s)/article of trade with or without a formal notice to the members sell the
              collateral to recover the principal and accrued interest. The collateral(s)/article of trade shall be sold in market overt.
            </li>
            <li>
              The member indemnifies the society and shall hold the society harmless from any and all actions arising from enforcing the terms & conditions for taking{' '}
              <strong>{society}.</strong>
            </li>
            <li>Repayment will be made weekly through the duration for the chosen tenure.</li>
          </ol>

          <h3 className="mb-2 mt-6 text-center font-heading text-base underline">Declaration</h3>
          <p className="text-justify text-[12px] leading-snug">
            I <Fill>{name}</Fill> have collected a document where the conditions for the loan are clearly stated and hereby acknowledge collection. I also fully
            understand the aforesaid terms and conditions of this group/cooperative society and hereby accept to abide by the rules and conditions herein specified. I
            also accept whatever actions agreed to indemnify the society myself in the event of any failure by them to remit the group's payment to the society. Also
            accept the receipt of the loaned sum from <strong>{society}.</strong>
          </p>
          <SignatureRow left="Signed" right="Date" />
        </section>

        {/* Guarantor's declaration and office use */}
        <section style={NEW_PAGE} className="pt-2">
          <h3 className="mb-2 font-heading text-sm font-bold">GUARANTOR'S DECLARATION FORM</h3>
          <p className="text-justify text-[12px] leading-snug">
            I <Fill>{guarantors.map((g) => g.fullName).join(' & ')}</Fill> declare that <Fill>{name}</Fill>. The borrower is well known to me. I am aware of his/her
            membership of <strong>{society}</strong> and have been acquainted with the terms and conditions of the society and the loan. I also guarantee to pay back the
            principal loan and accrued interest and indemnify <strong>{society}</strong> should the borrower breach any condition for which the loan is granted as
            contained on this form notwithstanding the conditions warranting such breach. By signing this form, where I failed to pay back the principal loan and
            accrued interest or indemnify the society within three days of demand, I hereby voluntarily grant <strong>{society}</strong> express consent and
            unrestricted access to enter upon my premise to take possession of chattels/articles of trade sufficient to satisfy the principal loan and accrued interest
            owed. And to sell the chattels in accordance with the terms and conditions to recover the principal and accrued interest, which shall not amount to
            trespass in any manner or form. I covenant to notify the society of any change in address or any other material fact contained in this form for both
            myself and the borrower before embarking on the change.
          </p>
          <SignatureRow left={`1. Signature/Date — 1st Guarantor${guarantors[0] ? ` (${guarantors[0].fullName})` : ''}`} right={`2. Signature/Date — 2nd Guarantor${guarantors[1] ? ` (${guarantors[1].fullName})` : ''}`} />
          <SignatureRow left="1. Signature/Date — 1st Witness" right="2. Signature/Date — 2nd Witness" />

          <h3 className="mb-3 mt-8 text-center font-heading text-base">For office use only</h3>
          <table className="w-full">
            <tbody>
              <Row label="Group name" value={groupName} />
              <Row label="Paying account officer" value={staffName} />
            </tbody>
          </table>
          <SignatureRow left="Executive/Sign" right="Team Leader/Sign" />
          <SignatureRow left={`Paying Account Officer Name/Sign${staffName ? ` (${staffName})` : ''}`} right="Manager/Sign" />
        </section>

        {/* Group guarantor's form */}
        <section style={NEW_PAGE} className="pt-2">
          <h2 className="mb-3 text-center font-heading text-lg">GROUP GUARANTOR'S FORM</h2>
          <p className="text-justify text-[12px] leading-snug">
            We <Fill>{groupName ?? ''}</Fill> Group hereby declare that <Fill>{name}</Fill> (the borrower) is well known to the group members (listed herein after). We
            also state that we know his/her residence and should he/she fail in his/her obligation to BC Kash, we individually, jointly and severally guarantee the
            borrower and declare that we will be liable to <strong>{society}</strong> in any amount in debit of the borrower.
          </p>
          <table className="mt-4 w-full text-[12px]">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="py-1">Name</th>
                <th className="py-1">Signature</th>
                <th className="py-1">Date</th>
              </tr>
            </thead>
            <tbody>
              {groupGuarantorRows(loanForm.groupMembers).map((row, index) => (
                <tr key={index} className="odd:bg-gray-100">
                  <td className="w-1/2 px-2 py-2">
                    {index + 1}. {row.label}: {row.name ?? '……………………………'}
                  </td>
                  <td className="px-2 py-2">……………………………</td>
                  <td className="px-2 py-2">……………………………</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Agreement between the member and the group */}
        <section style={NEW_PAGE} className="pt-2">
          <h2 className="mb-3 text-center font-heading text-lg">AGREEMENT BETWEEN</h2>
          <p className="text-[12px]">
            Mr./Mrs./Miss: <Fill>{name}</Fill> AND <Fill>{groupName ?? ''}</Fill> GROUP
          </p>
          <h3 className="mb-1 mt-3 text-xs font-bold">CONDITIONS FOR MEMBERSHIP</h3>
          <p className="text-justify text-[12px] leading-snug">
            Having been informed about <Fill>{groupName ?? ''}</Fill> group by <Fill>{''}</Fill> another member of group/friend/relation, and having been informed of the
            affiliation of the Group with <strong>{society}</strong>, I undertake to abide by the following conditions.
          </p>
          <ul className="mt-2 space-y-1 pl-5 text-justify text-[12px] leading-snug">
            <li>
              Deposit: Members are expected to deposit 35% of the loan amount they intend to take before collecting the loan or make six weeks payment after collecting
              the loan as deposit before commencement of the repayment of the loan. Members who make lump sum deposit will not be required to pay the six deposit
              installments. All deposit/savings will be repaid after the last person in the group has finished paying the loan collected NOTE: (Everybody's loan must be
              completed)
            </li>
            <li>
              Any breach of contract i.e. the tenure and required weekly payment etc. will attract a non-membership interest of 13% of the loan principal added to the
              agreed payment. This holds provided that the so called breach is within the life (tenure) of the loan. On Expiration, every outstanding amount shall attract
              a monthly interest of 5% which falls due on the next day of the month when the contract was consummated. NOTE: any breach of renewal attract a
              non-membership interest of 10% of the amount of loan. <strong>{society}</strong> considers those loan seekers who do not abide by the society's rule as
              non-members and therefore charges them a different interest from the one charged our members.
            </li>
            <li>
              That I shall be available at all weekly meetings of the group, where payment are made and other issues discussed and that I shall give advance information
              should there be any reason for my absence. I will therefore accept whatever actions agreed by the group in contravention of this agreement.
            </li>
            <li>That I will personally bring my money to meetings and personally ensure that the money is remitted to BC KASH.</li>
            <li>That I accept the cooperative creed which is responsibility to one is Responsibility to all which binds the group and the cooperative.</li>
            <li>
              That the money advanced to individual members of the group by the cooperative is deemed to have been advanced to the group as a whole so that the default
              of one member is deemed to be default of all.
            </li>
            <li>Group purse and thrift belong to members and their group. It is not normal repayment. However, it can be used in cases of unforeseen circumstances.</li>
            <li>That all the members of the group are collectively responsible to the complete and absolute repayment of all moneys advanced to the Group including accruing interests.</li>
            <li>The group purse belongs to the group and not to any individual member.</li>
            <li>
              That I will forfeit my group purse to the group if as at the time I cease to be a member the group still subsists. However I shall be entitled to thrift
              saving after one year of ceasing to be a member provided the group was not owing the cooperative during the tenure I was a member.
            </li>
            <li>That every member shares in the responsibility of ensuring that all money(s) advanced to the group is paid as at when due.</li>
            <li>That every money(s) (savings et al) due to members will only be paid when all payments to the cooperative have been received, including accruing interests.</li>
            <li>
              That relocation of members shall not constitute an excuse for nonpayment to the cooperative. That my indemnifier can also be held responsible by the group
              when I am unavailable or if available, cannot meet up with repayment.
            </li>
            <li>
              That at all times the group and its members shall remain faithful to this agreement of today ………………… (day) ………………… (month) …………………
            </li>
          </ul>
          <div className="mt-8 grid grid-cols-3 gap-x-6 gap-y-8 text-xs text-gray-600">
            <SignLine label={`Group Leader${leader ? ` (${leader})` : ''}`} />
            <SignLine label="Group Provost" />
            <SignLine label="Group Secretary" />
            <SignLine label={`Guarantor${guarantors[0] ? ` (${guarantors[0].fullName})` : ''}`} />
            <SignLine label={`Member (${name})`} />
          </div>
        </section>

        {/* Without prejudice: the reference form */}
        <section style={NEW_PAGE} className="pt-2">
          <h2 className="text-center font-heading text-lg">WITHOUT PREJUDICE</h2>
          <h2 className="mb-3 text-center font-heading text-lg">REFERENCE FORM</h2>
          <p className="text-justify text-[12px] leading-snug">
            <strong>{society}</strong> is a cooperative society committed to improving the lives and business of its members especially the women, through granting of
            credit to them.
          </p>
          <p className="mt-2 text-justify text-[12px] leading-snug">
            Mr./Mrs./Miss <Fill>{name}</Fill> Leader/secretary of <Fill>{''}</Fill> group had indicated interest in <Fill>{groupName ?? ''}</Fill> group which is
            affiliating to BC Kash, could you please reference this member. Your reference will to a great extent inform our decision not only to the member but to the
            group generally.
          </p>
          <div className="mt-3 flex justify-between text-[12px]">
            <span>SECTIONS 2</span>
            <span>
              ZONE: <Fill>{''}</Fill>
            </span>
          </div>
          <table className="mt-2 w-full text-[12px]">
            <tbody>
              <Row label="Mr./Mrs./Miss" value={name} />
              <tr>
                <td className="w-[45mm] py-1 pr-4 align-top text-gray-500">Marital status</td>
                <td className="py-1">
                  {maritalOptions(client).map((option) => (
                    <span key={option.label} className="mr-4 inline-flex items-center gap-1">
                      {option.label}
                      <span className="inline-flex h-4 w-4 items-center justify-center border border-gray-500 text-[10px] font-bold">{option.ticked ? '✓' : ''}</span>
                    </span>
                  ))}
                </td>
              </tr>
              <Row label="Occupation / type of business" value={client.occupation} />
              <Row label="Business address" value={client.businessAddress} />
              <Row label="Age" value={age === null ? null : String(age)} />
              <Row label="Loan granted" value={loanForm.proposedLoanAmount === null ? null : formatMoney(loanForm.proposedLoanAmount)} />
              <Row label="Tel" value={client.mobile ?? client.phone} />
            </tbody>
          </table>
          <p className="mt-4 text-justify text-[12px] leading-relaxed">
            Declaration: I <Fill>{reference?.fullName ?? ''}</Fill> of <Fill>{reference?.address ?? ''}</Fill> hereby declare that Mr/Mrs/Miss <Fill>{name}</Fill> of{' '}
            <Fill>{residentialAddress}</Fill> is well known to me and {pronoun(client.gender)} is of good character. Please feel comfortable to deal with{' '}
            {objectPronoun(client.gender)} in your business. I pledge to produce {objectPronoun(client.gender)} whenever needed.
          </p>
          {reference && (
            <p className="mt-1 text-[12px] text-gray-500">
              Referee: {reference.fullName}
              {reference.phone ? ` · ${reference.phone}` : ''}
              {reference.relationship ? ` · ${reference.relationship}` : ''}
            </p>
          )}
          <SignatureRow left="Signature" right="Date" />
          <p className="mt-6 text-[12px]">Verify by Manager</p>
          <SignatureRow left="Manager" right="Sign/Date" />
          <SignatureRow left="Authorized Signature" right="" />

          {loanForm.formFee !== null && (
            <p className="mt-8 text-center font-heading text-lg">NOTE: This form costs a non-refundable fee of {formatMoney(loanForm.formFee)}</p>
          )}
          <div className="mt-4 bg-emerald-100 p-4 text-xs text-gray-700 print:bg-emerald-100" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
            Other offices No 9, Obasanjo way, Itaeko Opp. Vet Hospital Abeokuta Ogun State Old Custom Building, Custom Junction, Ondo Road.. Akure Ondo State 64. Christ
            church street Owerri, Idimu, Badagry, Ikorodu, Sango etc
          </div>
        </section>
      </article>
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 border-b border-gray-200 pb-1 font-heading text-sm font-bold uppercase tracking-wider text-primary">{children}</h3>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <Heading>{title}</Heading>
      <table className="w-full">
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <tr>
      <td className="w-[45mm] py-1 pr-4 align-top text-gray-500">{label}</td>
      <td className="py-1 font-medium">{value || '—'}</td>
    </tr>
  );
}

/** A value written into the form's dotted blank; the dots stay when there's nothing to fill in. */
function Fill({ children }: { children: string }) {
  return children ? <span className="border-b border-dotted border-gray-500 px-1 font-semibold">{children}</span> : <span>……………………………</span>;
}

function SignLine({ label }: { label: string }) {
  return <div className="border-t border-gray-400 pt-1">{label}</div>;
}

function SignatureRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-10 text-xs text-gray-600">
      <SignLine label={left} />
      {right ? <SignLine label={right} /> : <div />}
    </div>
  );
}

/** Ten rows, as on the paper form: the group's members (leader first) with their role, then blank member rows. */
function groupGuarantorRows(members: ClientLoanForm['groupMembers']): { label: string; name: string | null }[] {
  if (members.length === 0) {
    return ['Leader', 'Secretary', 'Provost', ...Array<string>(7).fill('Member')].map((label) => ({ label, name: null }));
  }

  const rank = (role: string | null) => {
    const index = ROLE_ORDER.indexOf(role ?? 'member');
    return index === -1 ? ROLE_ORDER.length : index;
  };
  const rows = [...members]
    .sort((a, b) => rank(a.role) - rank(b.role))
    .map((m) => ({ label: GROUP_ROLE_LABELS[m.role ?? 'member'] ?? 'Member', name: m.name }));
  while (rows.length < 10) rows.push({ label: 'Member', name: null });
  return rows;
}

function maritalOptions(client: ClientDetail): { label: string; ticked: boolean }[] {
  const status = (client.maritalStatus ?? '').toLowerCase();
  const female = (client.gender ?? '').toLowerCase() === 'female';
  return [
    { label: 'Single', ticked: status === 'single' },
    { label: 'Married', ticked: status === 'married' },
    { label: 'Divorced', ticked: status === 'divorced' },
    { label: 'Widow', ticked: status === 'widowed' && female },
    { label: 'Widower', ticked: status === 'widowed' && !female },
  ];
}

function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age -= 1;
  return age;
}

function pronoun(gender: string | null): string {
  const g = (gender ?? '').toLowerCase();
  return g === 'female' ? 'she' : g === 'male' ? 'he' : 'he/she';
}

function objectPronoun(gender: string | null): string {
  const g = (gender ?? '').toLowerCase();
  return g === 'female' ? 'her' : g === 'male' ? 'him' : 'him/her';
}
