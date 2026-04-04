---
layout: default
---

<title>Sobriety Tracker</title>

<style>

body{
font-family:Arial;
/* background:#f4f4f4; */
padding:0px;
}

.month{
margin-bottom:30px;
}

.month-title{
font-weight:bold;
margin-bottom:10px;
}

.calendar{
display:grid;
grid-template-columns:repeat(7,1fr);
gap:6px;
max-width:420px;
}

.day{
padding:10px;
text-align:center;
border-radius:6px;
background:#ddd;
font-size:14px;
}

.sober{
background:#4CAF50;
color:white;
}

.relapse{
background:#E74C3C;
color:white;
}

.today{
outline:3px solid black;
}

</style>
</head>

<body>

<h2>Sobriety Tracker</h2>

<div id="container"></div>

<script>

fetch("sobriety.json")
.then(r=>r.json())
.then(data=>buildCalendar(data))

function buildCalendar(data){

const container=document.getElementById("container")
const today=new Date()

for(let m=2;m>=0;m--){

let d=new Date(today.getFullYear(),today.getMonth()-m,1)

let year=d.getFullYear()
let month=d.getMonth()

let daysInMonth=new Date(year,month+1,0).getDate()

const monthDiv=document.createElement("div")
monthDiv.className="month"

const title=document.createElement("div")
title.className="month-title"
title.textContent=d.toLocaleString('default',{month:'long',year:'numeric'})

const calendar=document.createElement("div")
calendar.className="calendar"

for(let i=1;i<=daysInMonth;i++){

const date=`${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`

const day=document.createElement("div")
day.className="day"
day.textContent=i

if(data[date]===true) day.classList.add("sober")
if(data[date]===false) day.classList.add("relapse")

if(date===today.toISOString().slice(0,10))
day.classList.add("today")

calendar.appendChild(day)

}

monthDiv.appendChild(title)
monthDiv.appendChild(calendar)
container.appendChild(monthDiv)

}

}

</script>
