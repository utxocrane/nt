const axios = require('axios');
const comm = require('./lib/common')

let saveList=[]
async function getOKX(){
	let careTickers={'BTC-USD':1,'LTC-USD':1,'ETH-USD':1,'ETC-USD':1,'XAUT-USDT':1,'PAXG-USD':1,'USDT-USD':1}
	console.log('开始查询OKX数据...')
	let res = await axios.get('https://www.okx.com/api/v5/market/tickers?instType=SPOT')
	console.log('OKX返回数据',res)
	res.data.data.forEach(v=>{
		if(careTickers[v.instId])
			saveList.push([v.instId,v.last,v.ts])
	})
}

async function get12data(){
	try{
	let res = await axios.get('https://api.twelvedata.com/quote?symbol=USD/CNH&apikey='+process.env.KEY12)
	saveList.push(['USD-CNH',res.data.close,res.data.last_quote_at])
	}catch(e){console.log(e.message)}
}

async function m(){
	await Promise.all([getOKX(), get12data()]);
	comm.updateGiteeFile(process.env.GITEETOKEN,process.env.GITEEURL,JSON.stringify(saveList))
}

m()