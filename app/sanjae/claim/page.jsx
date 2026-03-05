'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

const INITIAL_STATE = {
  // 청구 유형
  disabilityClaim: false,
  preventionClaim: false,

  // 근로자 정보
  victimName:   '',
  birthDate:    '',
  accidentDate: '',

  // 상병 정보
  diseaseName:  '',
  hospitalName: '',

  // 계좌 정보
  accountChange: false,
  accountType:   '',   // 'regular' | 'saving'
  bankName:      '',
  accountNumber: '',

  // 기왕증 / 보상 내역
  preExistingDisability: false,
  compensationReceived:  false,
  compensationDate:      '',
  compensationAmount:    '',
  compensationPayer:     '',
  transportCost:         '',

  // 청구인 / 대리인
  claimantName:  '',
  claimantPhone: '',
  agentName:     '',
  agentPhone:    '',
  claimDate:     '',

  // 지사
  officeName: '',
};

export default function SanJaeClaimPage() {
  const { data: session } = useSession();
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [loading,  setLoading]  = useState(false);

  if (session?.user?.role === 'READONLY') {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', fontFamily: "'Noto Sans KR', sans-serif" }}>
        <p style={{ fontSize: 48, margin: '0 0 16px' }}>🔒</p>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>접근 불가</h2>
        <p style={{ fontSize: 14, color: '#6b7280' }}>READONLY 권한으로는 서식 작성 페이지에 접근할 수 없습니다.</p>
      </div>
    );
  }

  function handleChange(e) {
    const { name, type, value, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: formData, debug: false }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'sanjae.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`PDF 생성 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>산재 장해급여 청구서</h1>
      <p style={s.subtitle}>입력 후 PDF 생성 버튼을 누르면 파일이 자동으로 다운로드됩니다.</p>

      <div style={s.form}>

        {/* ── 청구 유형 ─────────────────────────────── */}
        <Section label="청구 유형">
          <CheckRow name="disabilityClaim" label="장해급여 청구" checked={formData.disabilityClaim} onChange={handleChange} />
          <CheckRow name="preventionClaim" label="예방급여 청구" checked={formData.preventionClaim} onChange={handleChange} />
        </Section>

        {/* ── 근로자 정보 ───────────────────────────── */}
        <Section label="근로자 정보">
          <TextRow name="victimName"   label="피해자 성명"  placeholder="홍길동"                       value={formData.victimName}   onChange={handleChange} />
          <TextRow name="birthDate"    label="생년월일"     placeholder="YYYYMMDD (예: 19920109)"  value={formData.birthDate}    onChange={handleChange} maxLength={8} />
          <TextRow name="accidentDate" label="재해발생일"   placeholder="YYYYMMDD (예: 20240315)"  value={formData.accidentDate} onChange={handleChange} maxLength={8} />
        </Section>

        {/* ── 상병 정보 ─────────────────────────────── */}
        <Section label="상병 정보">
          <TextRow name="diseaseName"  label="상병명"   placeholder="요추간판탈출증"  value={formData.diseaseName}  onChange={handleChange} />
          <TextRow name="hospitalName" label="병원명"   placeholder="서울대학교병원" value={formData.hospitalName} onChange={handleChange} />
        </Section>

        {/* ── 계좌 정보 ─────────────────────────────── */}
        <Section label="계좌 정보">
          <CheckRow name="accountChange" label="계좌 변경" checked={formData.accountChange} onChange={handleChange} />
          <div style={s.row}>
            <span style={s.label}>계좌 유형</span>
            <div style={s.radioGroup}>
              <RadioRow name="accountType" value="regular" label="보통예금" checked={formData.accountType === 'regular'} onChange={handleChange} />
              <RadioRow name="accountType" value="saving"  label="저축예금" checked={formData.accountType === 'saving'}  onChange={handleChange} />
            </div>
          </div>
          <TextRow name="bankName"      label="은행명"   placeholder="국민은행"        value={formData.bankName}      onChange={handleChange} />
          <TextRow name="accountNumber" label="계좌번호" placeholder="123-456-789012"  value={formData.accountNumber} onChange={handleChange} />
        </Section>

        {/* ── 기왕증 / 보상 내역 ────────────────────── */}
        <Section label="기왕증 / 보상 내역">
          <CheckRow name="preExistingDisability" label="기왕증 있음"    checked={formData.preExistingDisability} onChange={handleChange} />
          <CheckRow name="compensationReceived"  label="보상 수령 있음" checked={formData.compensationReceived}  onChange={handleChange} />
          {formData.compensationReceived && <>
            <TextRow name="compensationDate"   label="보상 수령일" placeholder="YYYYMMDD"  value={formData.compensationDate}   onChange={handleChange} maxLength={8} />
            <TextRow name="compensationAmount" label="보상 금액"   placeholder="1,000,000" value={formData.compensationAmount} onChange={handleChange} />
            <TextRow name="compensationPayer"  label="보상 지급자" placeholder="근로복지공단" value={formData.compensationPayer}  onChange={handleChange} />
          </>}
          <TextRow name="transportCost" label="교통비" placeholder="50,000" value={formData.transportCost} onChange={handleChange} />
        </Section>

        {/* ── 청구인 / 대리인 ───────────────────────── */}
        <Section label="청구인 / 대리인">
          <TextRow name="claimantName"  label="청구인 성명"     placeholder="홍길동"        value={formData.claimantName}  onChange={handleChange} />
          <TextRow name="claimantPhone" label="청구인 전화번호" placeholder="010-0000-0000" value={formData.claimantPhone} onChange={handleChange} />
          <TextRow name="agentName"     label="대리인 성명"     placeholder="(없으면 공란)" value={formData.agentName}     onChange={handleChange} />
          <TextRow name="agentPhone"    label="대리인 전화번호" placeholder="(없으면 공란)" value={formData.agentPhone}    onChange={handleChange} />
          <TextRow name="claimDate"     label="청구일"          placeholder="YYYYMMDD (예: 20240410)" value={formData.claimDate} onChange={handleChange} maxLength={8} />
        </Section>

        {/* ── 지사 ──────────────────────────────────── */}
        <Section label="담당 지사">
          <TextRow name="officeName" label="지사명" placeholder="서울지사" value={formData.officeName} onChange={handleChange} />
        </Section>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ ...s.button, ...(loading ? s.buttonDisabled : {}) }}
        >
          {loading ? 'PDF 생성 중…' : 'PDF 생성 및 다운로드'}
        </button>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <fieldset style={s.section}>
      <legend style={s.sectionLabel}>{label}</legend>
      <div style={s.sectionBody}>{children}</div>
    </fieldset>
  );
}

function TextRow({ name, label, placeholder, value, onChange, maxLength }) {
  return (
    <div style={s.row}>
      <label htmlFor={name} style={s.label}>{label}</label>
      <input
        id={name}
        name={name}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        style={s.input}
      />
    </div>
  );
}

function CheckRow({ name, label, checked, onChange }) {
  return (
    <label style={s.checkRow}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        style={s.checkbox}
      />
      {label}
    </label>
  );
}

function RadioRow({ name, value, label, checked, onChange }) {
  return (
    <label style={s.checkRow}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        style={s.checkbox}
      />
      {label}
    </label>
  );
}

// ── 스타일 ─────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth:   560,
    margin:     '48px auto',
    padding:    '0 20px',
    fontFamily: "'Noto Sans KR', 'Malgun Gothic', sans-serif",
    color:      '#111',
  },
  title: {
    fontSize:     22,
    fontWeight:   700,
    marginBottom: 6,
  },
  subtitle: {
    fontSize:     13,
    color:        '#6b7280',
    marginBottom: 28,
  },
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
  },
  section: {
    border:       '1px solid #e5e7eb',
    borderRadius: 8,
    padding:      '12px 16px 16px',
    margin:       0,
  },
  sectionLabel: {
    fontSize:   12,
    fontWeight: 700,
    color:      '#6b7280',
    padding:    '0 4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionBody: {
    display:       'flex',
    flexDirection: 'column',
    gap:           12,
    marginTop:     8,
  },
  row: {
    display:       'flex',
    flexDirection: 'column',
    gap:           5,
  },
  label: {
    fontSize:   13,
    fontWeight: 600,
    color:      '#374151',
  },
  input: {
    padding:      '9px 12px',
    fontSize:     14,
    border:       '1px solid #d1d5db',
    borderRadius: 6,
    outline:      'none',
    color:        '#111',
    width:        '100%',
    boxSizing:    'border-box',
  },
  checkRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
    fontSize:   14,
    cursor:     'pointer',
  },
  checkbox: {
    width:  16,
    height: 16,
    cursor: 'pointer',
  },
  radioGroup: {
    display: 'flex',
    gap:     20,
  },
  button: {
    marginTop:    8,
    padding:      '11px 0',
    fontSize:     15,
    fontWeight:   700,
    color:        '#fff',
    background:   '#1d4ed8',
    border:       'none',
    borderRadius: 7,
    cursor:       'pointer',
    width:        '100%',
  },
  buttonDisabled: {
    background: '#93c5fd',
    cursor:     'wait',
  },
};
