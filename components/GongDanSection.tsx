"use client";
import { useState, useEffect, useMemo } from "react";
import {
  YEARLY_STATS, SIZE_STATS, INDUSTRY_STATS,
  SPECIAL_WORKER_STATS, FOREIGN_WORKER_STATS,
  MENTAL_DISEASE_STATS, DISEASE_COMMITTEE_STATS,
  PNEUMOCONIOSIS_STATS, SME_BASE_PAY, BASE_PAY_BY_REGION,
} from "@/lib/constants/gongdan";
import { KWC_BRANCH_DETAILS, KWC_DEFAULT_DETAIL } from "@/lib/constants/kwc-branches";

type GMenu = "branch"|"stats"|"disease"|"basepay"|"medical"|"partner";

// gongdan-branches.json 의 실제 필드 (no/name/address/jurisdiction/tel/fax)
type Branch = { no?:number; id?:string; name:string; address:string; jurisdiction:string; tel?:string; phone?:string; fax:string; hours?:string };
type Medical = { code:string; name:string; address:string; tel:string };
type Partner = { hospital:string; partner:string; period:string };

export default function GongDanSection() {
  const [menu, setMenu] = useState<GMenu>("branch");

  // 지사 데이터
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchQuery, setBranchQuery] = useState("");

  // 의료기관 데이터
  const [medical, setMedical] = useState<Medical[]>([]);
  const [medQuery, setMedQuery] = useState("");

  // 협력병원 데이터
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerHospital, setPartnerHospital] = useState("");

  // 통계 서브메뉴
  const [statType, setStatType] = useState<"yearly"|"size"|"industry"|"special"|"foreign">("yearly");
  const [statYear, setStatYear] = useState<number>(2024);

  useEffect(() => {
    if (menu === "branch" && branches.length === 0)
      fetch("/data/gongdan-branches.json").then(r=>r.json()).then(setBranches).catch(()=>{});
    if (menu === "medical" && medical.length === 0)
      fetch("/data/gongdan-medical.json").then(r=>r.json()).then(setMedical).catch(()=>{});
    if (menu === "partner" && partners.length === 0)
      fetch("/data/gongdan-partner-hospitals.json").then(r=>r.json()).then(setPartners).catch(()=>{});
  }, [menu]);

  const filteredBranches = useMemo(() =>
    branches.filter(b =>
      !branchQuery || b.name.includes(branchQuery) || b.address.includes(branchQuery) || b.jurisdiction.includes(branchQuery)
    ), [branches, branchQuery]);

  const filteredMedical = useMemo(() =>
    medQuery.length >= 2
      ? medical.filter(m => m.name.includes(medQuery) || m.address.includes(medQuery)).slice(0, 100)
      : [],
    [medical, medQuery]);

  const hospitalList = useMemo(() => [...new Set(partners.map(p=>p.hospital))].sort(), [partners]);
  const filteredPartners = useMemo(() =>
    partnerHospital ? partners.filter(p=>p.hospital === partnerHospital) : [],
    [partners, partnerHospital]);

  const fmt = (n:number) => n.toLocaleString();
  const fmtM = (n:number) => {
    const abs = Math.abs(n);
    if (abs >= 1e12) return (n/1e12).toFixed(1)+"조";
    if (abs >= 1e8)  return (n/1e8).toFixed(0)+"억";
    if (abs >= 1e4)  return (n/1e4).toFixed(0)+"만";
    return n.toLocaleString();
  };

  const menuItems: [GMenu, string][] = [
    ["branch",  "🏢 지사 안내"],
    ["stats",   "📊 산재 통계"],
    ["disease", "⚕️ 질병 현황"],
    ["basepay", "💰 기준보수"],
    ["medical", "🏥 지정의료기관"],
    ["partner", "🤝 협력병원"],
  ];

  return (
    <div style={{padding:"0 0 40px"}}>
      {/* 서브 탭 */}
      <div style={{display:"flex",gap:0,borderBottom:"2px solid #e5e7eb",background:"#f9fafb",flexWrap:"wrap",marginBottom:0}}>
        {menuItems.map(([key,label])=>(
          <button key={key} onClick={()=>setMenu(key)} style={{
            padding:"10px 16px",fontSize:13,fontWeight:menu===key?700:500,
            border:"none",borderBottom:menu===key?"3px solid #059669":"3px solid transparent",
            background:menu===key?"#fff":"transparent",
            color:menu===key?"#059669":"#6b7280",cursor:"pointer",whiteSpace:"nowrap",
          }}>{label}</button>
        ))}
      </div>

      <div style={{padding:"20px 16px"}}>

        {/* 🏢 지사 안내 */}
        {menu === "branch" && (
          <BranchInfoSection branches={branches} filteredBranches={filteredBranches} branchQuery={branchQuery} setBranchQuery={setBranchQuery} />
        )}

        {/* 📊 산재 통계 */}
        {menu === "stats" && (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
              {([["yearly","연도별 처리현황"],["size","규모별 승인현황"],["industry","업종별 승인현황"],["special","노무제공자(특고)"],["foreign","외국인근로자"]] as [typeof statType,string][]).map(([k,l])=>(
                <button key={k} onClick={()=>setStatType(k)} style={{
                  padding:"7px 14px",fontSize:12,fontWeight:statType===k?700:400,
                  border:"1px solid "+(statType===k?"#1e40af":"#d1d5db"),
                  borderRadius:20,background:statType===k?"#1e40af":"#fff",
                  color:statType===k?"#fff":"#374151",cursor:"pointer",
                }}>{l}</button>
              ))}
            </div>

            {/* 연도별 처리현황 */}
            {statType === "yearly" && (
              <div style={{overflowX:"auto"}}>
                <p style={{fontSize:12,color:"#6b7280",marginBottom:8}}>출처: 근로복지공단 연도별 산재처리현황 (2024년 기준)</p>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:700}}>
                  <thead>
                    <tr style={{background:"#f3f4f6"}}>
                      <th style={thStyle}>연도</th>
                      <th style={thStyle}>신청(건)</th>
                      <th style={thStyle}>사고 신청</th>
                      <th style={thStyle}>질병 신청</th>
                      <th style={thStyle}>출퇴근 신청</th>
                      <th style={thStyle}>승인(건)</th>
                      <th style={thStyle}>사고 승인</th>
                      <th style={thStyle}>질병 승인</th>
                      <th style={thStyle}>출퇴근 승인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {YEARLY_STATS.map((r,i)=>(
                      <tr key={r.year} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                        <td style={{...tdStyle,fontWeight:700}}>{r.year}</td>
                        <td style={{...tdStyle,color:"#1e40af"}}>{fmt(r.apply)}</td>
                        <td style={tdStyle}>{fmt(r.accApply)}</td>
                        <td style={tdStyle}>{fmt(r.disApply)}</td>
                        <td style={tdStyle}>{r.comApply!=null?fmt(r.comApply):"-"}</td>
                        <td style={{...tdStyle,color:"#059669"}}>{fmt(r.approve)}</td>
                        <td style={tdStyle}>{fmt(r.accApprove)}</td>
                        <td style={tdStyle}>{fmt(r.disApprove)}</td>
                        <td style={tdStyle}>{r.comApprove!=null?fmt(r.comApprove):"-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 규모별 승인현황 */}
            {statType === "size" && (
              <div>
                <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                  {[2018,2019,2020,2021,2022,2023,2024].map(y=>(
                    <button key={y} onClick={()=>setStatYear(y)} style={{
                      padding:"5px 12px",fontSize:12,border:"1px solid "+(statYear===y?"#1e40af":"#d1d5db"),
                      borderRadius:4,background:statYear===y?"#1e40af":"#fff",color:statYear===y?"#fff":"#374151",cursor:"pointer",
                    }}>{y}년</button>
                  ))}
                </div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,maxWidth:500}}>
                  <thead>
                    <tr style={{background:"#f3f4f6"}}>
                      <th style={thStyle}>사업장 규모</th>
                      <th style={thStyle}>신청</th>
                      <th style={thStyle}>승인</th>
                      <th style={thStyle}>승인율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SIZE_STATS.filter(r=>r.year===statYear).map((r,i)=>(
                      <tr key={r.size} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                        <td style={{...tdStyle,fontWeight:600}}>{r.size}</td>
                        <td style={tdStyle}>{fmt(r.apply)}</td>
                        <td style={tdStyle}>{fmt(r.approve)}</td>
                        <td style={{...tdStyle,color:r.rate>=90?"#059669":r.rate>=80?"#d97706":"#dc2626",fontWeight:700}}>{r.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 업종별 승인현황 */}
            {statType === "industry" && (
              <div>
                <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                  {[2018,2019,2020,2021,2022,2023,2024].map(y=>(
                    <button key={y} onClick={()=>setStatYear(y)} style={{
                      padding:"5px 12px",fontSize:12,border:"1px solid "+(statYear===y?"#1e40af":"#d1d5db"),
                      borderRadius:4,background:statYear===y?"#1e40af":"#fff",color:statYear===y?"#fff":"#374151",cursor:"pointer",
                    }}>{y}년</button>
                  ))}
                </div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,maxWidth:500}}>
                  <thead>
                    <tr style={{background:"#f3f4f6"}}>
                      <th style={thStyle}>업종</th>
                      <th style={thStyle}>신청</th>
                      <th style={thStyle}>승인</th>
                      <th style={thStyle}>승인율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INDUSTRY_STATS.filter(r=>r.year===statYear).map((r,i)=>(
                      <tr key={r.industry} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                        <td style={{...tdStyle,fontWeight:600}}>{r.industry}</td>
                        <td style={tdStyle}>{fmt(r.apply)}</td>
                        <td style={tdStyle}>{fmt(r.approve)}</td>
                        <td style={{...tdStyle,color:r.rate>=90?"#059669":r.rate>=70?"#d97706":"#dc2626",fontWeight:700}}>{r.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 노무제공자(특고) */}
            {statType === "special" && (
              <div>
                <p style={{fontSize:12,color:"#6b7280",marginBottom:12}}>2018~2024년 주요 직종별 산재 신청·승인 현황</p>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",fontSize:12,minWidth:600}}>
                    <thead>
                      <tr style={{background:"#f3f4f6"}}>
                        <th style={{...thStyle,textAlign:"left"}}>직종</th>
                        {[2018,2019,2020,2021,2022,2023,2024].map(y=><th key={y} style={thStyle} colSpan={2}>{y}</th>)}
                      </tr>
                      <tr style={{background:"#f9fafb"}}>
                        <th style={thStyle}></th>
                        {[2018,2019,2020,2021,2022,2023,2024].map(y=>[
                          <th key={y+"a"} style={{...thStyle,fontSize:11,color:"#1e40af"}}>신청</th>,
                          <th key={y+"b"} style={{...thStyle,fontSize:11,color:"#059669"}}>승인</th>,
                        ])}
                      </tr>
                    </thead>
                    <tbody>
                      {["보험모집인","건설기계조종사","골프장캐디","택배기사","퀵서비스기사","화물차주","대리운전기사"].map((job,i)=>(
                        <tr key={job} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                          <td style={{...tdStyle,fontWeight:600,whiteSpace:"nowrap"}}>{job}</td>
                          {[2018,2019,2020,2021,2022,2023,2024].map(y=>{
                            const d = SPECIAL_WORKER_STATS.find(s=>s.job===job&&s.year===y);
                            return [
                              <td key={y+"a"} style={{...tdStyle,color:"#1e40af"}}>{d?fmt(d.apply):"-"}</td>,
                              <td key={y+"b"} style={{...tdStyle,color:"#059669"}}>{d?fmt(d.approve):"-"}</td>,
                            ];
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 외국인근로자 */}
            {statType === "foreign" && (
              <div>
                <p style={{fontSize:12,color:"#6b7280",marginBottom:12}}>외국인근로자 산재처리현황 (2018~2024)</p>
                <table style={{borderCollapse:"collapse",fontSize:13,minWidth:400}}>
                  <thead>
                    <tr style={{background:"#f3f4f6"}}>
                      <th style={thStyle}>구분</th>
                      {FOREIGN_WORKER_STATS.years.map(y=><th key={y} style={thStyle}>{y}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{background:"#fff"}}>
                      <td style={{...tdStyle,fontWeight:700,color:"#dc2626"}}>사고 신청</td>
                      {FOREIGN_WORKER_STATS.accident.apply.map((v,i)=><td key={i} style={tdStyle}>{fmt(v)}</td>)}
                    </tr>
                    <tr style={{background:"#f9fafb"}}>
                      <td style={{...tdStyle,fontWeight:700,color:"#059669"}}>사고 승인</td>
                      {FOREIGN_WORKER_STATS.accident.approve.map((v,i)=><td key={i} style={tdStyle}>{fmt(v)}</td>)}
                    </tr>
                    <tr style={{background:"#fff"}}>
                      <td style={{...tdStyle,fontWeight:700,color:"#7c3aed"}}>질병 신청</td>
                      {FOREIGN_WORKER_STATS.disease.apply.map((v,i)=><td key={i} style={tdStyle}>{fmt(v)}</td>)}
                    </tr>
                    <tr style={{background:"#f9fafb"}}>
                      <td style={{...tdStyle,fontWeight:700,color:"#d97706"}}>질병 승인</td>
                      {FOREIGN_WORKER_STATS.disease.approve.map((v,i)=><td key={i} style={tdStyle}>{fmt(v)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ⚕️ 질병 현황 */}
        {menu === "disease" && (
          <div style={{display:"flex",gap:32,flexWrap:"wrap"}}>
            {/* 업무상질병판정위원회 */}
            <div>
              <h3 style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:10,borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>업무상질병판정위원회 질병별 판정현황</h3>
              <table style={{borderCollapse:"collapse",fontSize:13,minWidth:360}}>
                <thead>
                  <tr style={{background:"#f3f4f6"}}>
                    <th style={thStyle}>질병명</th>
                    <th style={thStyle}>판정(건)</th>
                    <th style={thStyle}>인정(건)</th>
                    <th style={thStyle}>인정률</th>
                  </tr>
                </thead>
                <tbody>
                  {DISEASE_COMMITTEE_STATS.map((r,i)=>(
                    <tr key={r.name} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                      <td style={{...tdStyle,fontWeight:600}}>{r.name}</td>
                      <td style={tdStyle}>{fmt(r.judge)}</td>
                      <td style={tdStyle}>{fmt(r.admit)}</td>
                      <td style={{...tdStyle,color:r.rate>=60?"#059669":r.rate>=40?"#d97706":"#dc2626",fontWeight:700}}>{r.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 정신질병 현황 */}
            <div>
              <h3 style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:10,borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>업무상재해 정신질병 현황 (2011~2024)</h3>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:12,minWidth:700}}>
                  <thead>
                    <tr style={{background:"#f3f4f6"}}>
                      <th style={{...thStyle,textAlign:"left"}}>구분</th>
                      {MENTAL_DISEASE_STATS.years.map(y=><th key={y} style={thStyle}>{y}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{background:"#fff"}}>
                      <td style={{...tdStyle,fontWeight:700,color:"#1e40af"}}>신청</td>
                      {MENTAL_DISEASE_STATS.apply.map((v,i)=><td key={i} style={tdStyle}>{v}</td>)}
                    </tr>
                    <tr style={{background:"#f9fafb"}}>
                      <td style={{...tdStyle,fontWeight:700,color:"#059669"}}>승인</td>
                      {MENTAL_DISEASE_STATS.approve.map((v,i)=><td key={i} style={tdStyle}>{v}</td>)}
                    </tr>
                    {MENTAL_DISEASE_STATS.details.map((d,di)=>(
                      <tr key={d.name} style={{background:di%2===0?"#fff":"#f9fafb"}}>
                        <td style={{...tdStyle,color:"#6b7280",paddingLeft:16}}>└ {d.name}</td>
                        {d.data.map((v,i)=><td key={i} style={{...tdStyle,color:"#6b7280"}}>{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 진폐 */}
              <h3 style={{fontSize:15,fontWeight:700,color:"#111827",margin:"24px 0 10px",borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>산재 진폐 현황 (병상·진료)</h3>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:12,minWidth:320}}>
                  <thead>
                    <tr style={{background:"#f3f4f6"}}>
                      <th style={thStyle}>연도</th>
                      <th style={thStyle}>병상수(개)</th>
                      <th style={thStyle}>입원(명)</th>
                      <th style={thStyle}>통원(명)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PNEUMOCONIOSIS_STATS.map((r,i)=>(
                      <tr key={r.year} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                        <td style={{...tdStyle,fontWeight:600}}>{r.year}</td>
                        <td style={tdStyle}>{fmt(r.beds)}</td>
                        <td style={tdStyle}>{fmt(r.inpatient)}</td>
                        <td style={tdStyle}>{fmt(r.outpatient)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 💰 기준보수 */}
        {menu === "basepay" && (
          <div>
            <div style={{display:"flex",gap:32,flexWrap:"wrap"}}>
              {/* 중소기업사업주 */}
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:10,borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>중소기업사업주 기준보수 (2025년 기준)</h3>
                <table style={{borderCollapse:"collapse",fontSize:13,minWidth:280}}>
                  <thead>
                    <tr style={{background:"#f3f4f6"}}>
                      <th style={thStyle}>등급</th>
                      <th style={thStyle}>보수액(월)</th>
                      <th style={thStyle}>평균임금(1일)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SME_BASE_PAY.map((r,i)=>(
                      <tr key={r.grade} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                        <td style={{...tdStyle,fontWeight:700,textAlign:"center"}}>{r.grade}</td>
                        <td style={tdStyle}>{r.monthly.toLocaleString()}원</td>
                        <td style={{...tdStyle,color:"#059669",fontWeight:600}}>{r.daily.toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 지역×업종 기준보수 */}
              <div style={{flex:1,minWidth:0}}>
                <h3 style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:10,borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>지역별·업종별 기준보수 현황 (2025년 기준, 단위: 원)</h3>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",fontSize:11,minWidth:900}}>
                    <thead>
                      <tr style={{background:"#f3f4f6"}}>
                        <th style={{...thStyle,textAlign:"left",minWidth:50}}>지역</th>
                        {BASE_PAY_BY_REGION[0].industries.map(ind=>(
                          <th key={ind.name} style={{...thStyle,fontSize:10,whiteSpace:"nowrap",minWidth:60}}>{ind.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BASE_PAY_BY_REGION.map((row,i)=>(
                        <tr key={row.region} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                          <td style={{...tdStyle,fontWeight:700}}>{row.region}</td>
                          {row.industries.map(ind=>(
                            <td key={ind.name} style={{...tdStyle,fontSize:11,textAlign:"right"}}>
                              {(ind.amount/10000).toFixed(0)}만
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🏥 지정의료기관 */}
        {menu === "medical" && (
          <div>
            <div style={{marginBottom:12}}>
              <input value={medQuery} onChange={e=>setMedQuery(e.target.value)}
                placeholder="기관명 또는 주소 2글자 이상 입력..."
                style={{padding:"8px 12px",fontSize:13,border:"1px solid #d1d5db",borderRadius:6,width:280}} />
              <span style={{fontSize:12,color:"#6b7280",marginLeft:12}}>총 {medical.length.toLocaleString()}개 기관 · {medQuery.length>=2?`${filteredMedical.length}건 검색됨 (최대 100건)`:""}</span>
            </div>
            {medQuery.length < 2 ? (
              <div style={{padding:40,textAlign:"center",color:"#9ca3af",fontSize:14}}>기관명 또는 주소를 2글자 이상 입력하면 검색됩니다.</div>
            ) : filteredMedical.length === 0 ? (
              <div style={{padding:40,textAlign:"center",color:"#9ca3af",fontSize:14}}>검색 결과가 없습니다.</div>
            ) : (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{background:"#f3f4f6"}}>
                      {["기관명","주소","전화번호"].map(h=>(
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMedical.map((m,i)=>(
                      <tr key={m.code} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                        <td style={{...tdStyle,fontWeight:600,color:"#1e40af",whiteSpace:"nowrap"}}>{m.name}</td>
                        <td style={tdStyle}>{m.address}</td>
                        <td style={{...tdStyle,whiteSpace:"nowrap"}}><a href={`tel:${m.tel}`} style={{color:"#059669",textDecoration:"none"}}>{m.tel}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 🤝 협력병원 */}
        {menu === "partner" && (
          <div>
            <div style={{marginBottom:12,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
              <select value={partnerHospital} onChange={e=>setPartnerHospital(e.target.value)}
                style={{padding:"8px 12px",fontSize:13,border:"1px solid #d1d5db",borderRadius:6,cursor:"pointer"}}>
                <option value="">-- 공단병원 선택 --</option>
                {hospitalList.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
              {partnerHospital && <span style={{fontSize:12,color:"#6b7280"}}>{filteredPartners.length}개 협력병원</span>}
            </div>
            {!partnerHospital ? (
              <div style={{padding:40,textAlign:"center",color:"#9ca3af",fontSize:14}}>공단병원을 선택하면 협력병원 목록이 표시됩니다.</div>
            ) : (
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,maxWidth:600}}>
                <thead>
                  <tr style={{background:"#f3f4f6"}}>
                    <th style={thStyle}>협력병원명</th>
                    <th style={thStyle}>협력기간</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.map((p,i)=>(
                    <tr key={i} style={{background:i%2===0?"#fff":"#f9fafb"}}>
                      <td style={{...tdStyle,fontWeight:600,color:"#1e40af"}}>{p.partner}</td>
                      <td style={{...tdStyle,color:"#6b7280"}}>{p.period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding:"8px 10px",textAlign:"center",fontWeight:600,color:"#374151",
  borderBottom:"2px solid #e5e7eb",background:"#f9fafb",whiteSpace:"nowrap",fontSize:12,
};
const tdStyle: React.CSSProperties = {
  padding:"7px 10px",textAlign:"center",borderBottom:"1px solid #f3f4f6",color:"#374151",fontSize:12,
};

// ─── 지사 안내 (보강) ────────────────────────────────────────────────────────

function BranchInfoSection({
  branches,
  filteredBranches,
  branchQuery,
  setBranchQuery,
}: {
  branches: Branch[];
  filteredBranches: Branch[];
  branchQuery: string;
  setBranchQuery: (s: string) => void;
}) {
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const selectedBranch = useMemo(
    () => branches.find(b => b.name === selectedName),
    [branches, selectedName]
  );
  const selectedDetail = selectedName ? KWC_BRANCH_DETAILS[selectedName] : undefined;

  const phone = selectedBranch?.tel ?? selectedBranch?.phone;

  return (
    <div>
      {/* 검색 + 통계 */}
      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={branchQuery}
          onChange={e => setBranchQuery(e.target.value)}
          placeholder="기관명·지역·관할구역 검색..."
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, width: 280 }}
        />
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          총 {branches.length}개 기관 · {filteredBranches.length}개 검색됨
        </span>
        <a
          href="https://www.comwel.or.kr/comwel/intr/srch/srch.jsp"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginLeft: "auto", fontSize: 12, color: "#1e40af", textDecoration: "none" }}
        >
          공단 지사 검색 ↗
        </a>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* 좌측: 카드 그리드 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}>
            {filteredBranches.map((b, i) => {
              const detail = KWC_BRANCH_DETAILS[b.name];
              const hasDetail = !!detail;
              const isSelected = selectedName === b.name;
              return (
                <button
                  key={b.name + i}
                  onClick={() => setSelectedName(b.name)}
                  style={{
                    textAlign: "left", cursor: "pointer",
                    background: isSelected ? "#eff6ff" : "#fff",
                    border: `1px solid ${isSelected ? "#3b82f6" : "#e5e7eb"}`,
                    borderRadius: 8, padding: "12px 14px",
                    display: "flex", flexDirection: "column", gap: 6,
                    boxShadow: isSelected ? "0 0 0 2px rgba(59,130,246,0.1)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", flex: 1, lineHeight: 1.4 }}>
                      {b.name}
                    </span>
                    {hasDetail && (
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#8DC63F", color: "#fff", fontWeight: 700 }}>
                        상세
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>
                    {b.address}
                  </div>
                  {b.jurisdiction && (
                    <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.4, paddingTop: 4, borderTop: "1px dashed #e5e7eb" }}>
                      <span style={{ fontWeight: 600, color: "#9ca3af" }}>관할: </span>
                      {b.jurisdiction}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#059669" }}>
                    <span>📞 {b.tel ?? b.phone ?? "-"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우측: 상세 패널 (선택 시) */}
        {selectedBranch && (
          <div style={{
            width: 360, flexShrink: 0, position: "sticky", top: 0,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: 16, maxHeight: "calc(100vh - 200px)", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
              <h3 style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>
                {selectedBranch.name}
              </h3>
              <button
                onClick={() => setSelectedName(null)}
                style={{ fontSize: 14, background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}
              >✕</button>
            </div>

            {/* 주소 */}
            <DetailRow label="주소" value={selectedBranch.address} />
            {selectedDetail?.postalCode && (
              <DetailRow label="우편번호" value={selectedDetail.postalCode} />
            )}

            {/* 연락처 */}
            {phone && <DetailRow label="전화" value={<a href={`tel:${phone}`} style={{ color: "#059669", textDecoration: "none" }}>{phone}</a>} />}
            {selectedDetail?.representativeTel && selectedDetail.representativeTel !== phone && (
              <DetailRow label="대표번호" value={<a href={`tel:${selectedDetail.representativeTel}`} style={{ color: "#059669", textDecoration: "none" }}>{selectedDetail.representativeTel}</a>} />
            )}
            {selectedBranch.fax && <DetailRow label="팩스" value={selectedBranch.fax} />}
            {selectedDetail?.email && <DetailRow label="이메일" value={selectedDetail.email} />}

            {/* 운영시간 */}
            <DetailRow label="운영시간" value={selectedDetail?.hours ?? KWC_DEFAULT_DETAIL.hours ?? "-"} />

            {/* 관할 */}
            {selectedBranch.jurisdiction && (
              <DetailRow label="관할" value={selectedBranch.jurisdiction} />
            )}

            {/* 교통편 */}
            {selectedDetail?.directions && (
              <DetailRow label="교통편" value={selectedDetail.directions} />
            )}
            {selectedDetail?.parkingInfo && (
              <DetailRow label="주차" value={selectedDetail.parkingInfo} />
            )}

            {/* 주요 업무 */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>주요 업무</div>
              <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12, color: "#374151", lineHeight: 1.7 }}>
                {(selectedDetail?.services ?? KWC_DEFAULT_DETAIL.services ?? []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            {/* 특수부서 */}
            {selectedDetail?.specialUnits && selectedDetail.specialUnits.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>특수부서</div>
                {selectedDetail.specialUnits.map((u, i) => (
                  <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: "#f9fafb", borderRadius: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>{u.name}</div>
                    {u.address && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{u.address}</div>}
                    {u.tel && <div style={{ fontSize: 11, color: "#059669", marginTop: 2 }}>📞 {u.tel}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* 상세 정보 미보강 안내 */}
            {!selectedDetail && (
              <div style={{ marginTop: 12, padding: "8px 10px", background: "#fef9c3", borderRadius: 6, fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
                ⓘ 이 지사는 추가 상세 정보(우편번호·교통편 등)가 아직 등록되지 않았습니다.
                기본 업무·운영시간 정보만 표시됩니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12, lineHeight: 1.5 }}>
      <div style={{ width: 60, flexShrink: 0, color: "#9ca3af", fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, color: "#374151" }}>{value}</div>
    </div>
  );
}
