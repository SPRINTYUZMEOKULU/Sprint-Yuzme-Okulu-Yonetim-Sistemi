export default function AttendanceSummary({summary, layout = "inline"}: {summary?: {present: number; absent: number; excused: number} | null; layout?: "inline" | "cards"}) {
  if (!summary) return <span>Yoklama bilgisi alınamadı</span>;
  if (layout === "cards") {
    const items = [
      { label: "Geldi", value: summary.present, color: "#087443", background: "#ecfdf3", border: "#ccebd9" },
      { label: "Gelmedi", value: summary.absent, color: "#b42318", background: "#fff1f2", border: "#fecdd3" },
      { label: "İzinli", value: summary.excused, color: "#475569", background: "#f1f5f9", border: "#dbe3ed" },
    ];
    return <span role="group" aria-label="Bu kayıt döneminin yoklaması" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,width:"100%",minWidth:0}}>
      {items.map(item => <span key={item.label} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,minWidth:0,padding:"10px 2px",borderRadius:10,border:`1px solid ${item.border}`,background:item.background,color:item.color,lineHeight:1.3}}>
        <span style={{fontSize:11,fontWeight:600,whiteSpace:"nowrap",color:item.color}}>{item.label}</span>
        <strong style={{fontSize:20,fontWeight:800,fontVariantNumeric:"tabular-nums",color:item.color}}>{item.value}</strong>
      </span>)}
    </span>;
  }
  return <span aria-label="Bu kayıt döneminin yoklaması" style={{display:"flex",flexWrap:"wrap",justifyContent:"inherit",gap:"4px 10px",fontSize:12,lineHeight:1.6,fontWeight:600}}>
    <span style={{color:"#087443"}}>Geldi: {summary.present}</span>
    <span style={{color:"#b42318"}}>Gelmedi: {summary.absent}</span>
    <span style={{color:"#64748b"}}>İzinli: {summary.excused}</span>
  </span>;
}
