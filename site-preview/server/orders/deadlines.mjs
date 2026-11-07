import plan from '../../src/data/delivery.json' with {type:'json'};
// The same approved calendar used in customer estimates, interpreted in UTC.
export function productionDeadline(paidAt) {
  const day=new Date(paidAt); if(!Number.isFinite(day.getTime())) return null;
  day.setUTCHours(23,59,59,999);
  for(let left=plan.productionBusinessDays[1];left>0;) {
    day.setUTCDate(day.getUTCDate()+1);
    if(day.getUTCDay()%6!==0 && !plan.closedDates.includes(day.toISOString().slice(0,10))) left--;
  }
  return day.toISOString();
}
