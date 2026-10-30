export default function AttendanceSummary({summary}: {summary?: {present: number; absent: number; excused: number} | null}) {
  if (!summary) return <span>Yoklama bilgisi alınamadı</span>;
  return <span aria-label="Bu kayıt döneminin yoklaması" style={{display:"flex",flexWrap:"wrap",justifyContent:"inherit",gap:"4px 10px",fontSize:12,lineHeight:1.6,fontWeight:600}}>
    <span style={{color:"#087443"}}>Geldi: {summary.present}</span>
    <span style={{color:"#b42318"}}>Gelmedi: {summary.absent}</span>
    <span style={{color:"#64748b"}}>İzinli: {summary.excused}</span>
  </span>;
}
