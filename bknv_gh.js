const axios=require('axios')
const fs=require('fs')
const path=require('path')
const https=require('https')

const agent = new https.Agent({
  rejectUnauthorized: false,  // 工行得跳过证书验证
  secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function str2date8(s){
	return s.slice(0, 4)+'/'+parseInt(s.slice(4,6))+'/'+parseInt(dateStr.slice(6, 8))
}

let invTab=[]//归一化数据在这里

//中行数据
async function getBocData(){
	let reqbody = {"header":{"agent":"X-ANDR","version":"3.1.9","device":"android","platform":"android","plugins":"5","page":"6","local":"zh_CN","uuid":"1784441108674129532660","ext":"8","cipherType":"0","appSequence":""},"method":"PsnxWmpNewProductListQueryOutlay","params":{"pageSize":"14","currentIndex":"0","subChannelId":"31","productType":"03","raiseMethod":"PUB","wmpmFirstClass":"QBLC","queryIsNewLine":"1","wmpmPeriodFlag":"","currencySign":"CNY","riskLevel":"R1,R2","startAmount":"","managerCode":"","queryOption":"","sortType":"0","sortField":"4","productSaleStatus":"","isQredeem":"","isPREF":"","wmpmSecondFlag":"","isRaisingEndDate":"","indiCustomerLevel":""}}
	const pageSize=14,maxStartIndex=1400 //中行数据需分页读取，测试，只搞1页
	
	const invList=[]
	for(let si=0;si<=maxStartIndex;si+=pageSize){
		reqbody.params.currentIndex = ""+si
		let res = await axios.post('https://ebsnew.boc.cn/BMPS/_bfwajax.do?rnd=12043&_locale=zh_CN','json='+encodeURI(JSON.stringify(reqbody)))
		invList.push(...res.data.result.list)
		console.log('中行]加载',si)
		if(res.data.result.list.length<pageSize){
			console.log('网站记录已全部加载')
			break
		}
	}
	
	reqbody = {"header":{"agent":"X-ANDR","version":"3.1.9","device":"android","platform":"android","plugins":"5","page":"6","local":"zh_CN","uuid":"1784443459469103616457","ext":"8","cipherType":"0","appSequence":""},"method":"PsnxWmpProductYieldQueryOutlay","params":{"productId":"25GS2779","subChannelId":"31"}}
	for(let v of invList){
		reqbody.params.productId = v.productId
		const restAmt = parseFloat(v.indiAmtRem)
		if(restAmt < 1000){
			console.log('中行]',v.productId,'剩余额度不足，跳过解析...')
			continue
		}
		let res = await axios.post('https://ebsnew.boc.cn/BMPS/_bfwajax.do?rnd=16126&_locale=zh_CN','json='+encodeURI(JSON.stringify(reqbody)))
		for(let r of res.data.result.list) v['ir'+r.incomerateDisplayFeature] = parseFloat(r.incomeRatio)||0

		invTab.push({bank:'中行',id:v.productId,name:v.productName,lockDays:v.periodTerm||1,manager:v.managerShortName,risk:parseInt(v.riskLevel.slice(1,2)),startDate:v.yieldStartDate,lastDate:v.yieldEndDate,irM1:v.irM1||0,irM3:v.irM3||0,irM6:v.irM6||0,ir:v.irYE||v.newYield||0,restAmt:restAmt })
		console.log('中行加载',v.productId+'\t'+v.periodTerm+'\t'+v.managerShortName+'\t'+(v.newYield*100).toFixed(2)+'\t'+v.riskLevel+'\t'+v.yieldStartDate+'\t'+v.yieldEndDate)
	}
}

//工行
async function getIcbcData(){
	const timeIntervalMap={
		'近1月':'M1',
		'近3月':'M3',
		'近6月':'M6',
		'成立以来':'YE'
	}
	reqbody = {searchInfo:"",curr:"人民币",term:"",type:"",rile:"",utty:"",pageIndex:1,pageSize:9999} //搜索参数
	let res = await axios.post('https://papi.icbc.com.cn/finance/financeWap/searchList',reqbody,{
		headers: {
		'Content-Type': 'application/json',
		'x-tag-papi': 'gray'
		},
		httpsAgent:agent
	})
	res = res.data.data.list
	//console.log('工行总记录数',)
	for(let [i,v] of res.entries()){//for(let [v,i] of [4,5,6].entries())console.log(v)
		let r = parseInt(v.lowestBuyLevel) || 0
		
		//年化字符串解析
		const match = v.yieldValue.match(/^([\d.]+)%/)
		
		const newRow={bank:'工行',id:v.productId,ir:match ? parseFloat(match[1]) : 0,name:v.productName,lockDays:parseInt(v.productTerm.replace('天','').replace('最短持有','').replace('无固定期限','0')),risk:r}
		invTab.push(newRow)
		if(r>2) continue //风险过高，暂不取数
		
		//取明细数据
		let sleepMs=500
		while(true){
			try{
				console.log('工行]查询',i,'/',res.length,v.productId,v.productName,'风险级',r,v.lowestBuyLevel)
				let resDtl = (await axios.post('https://papi.icbc.com.cn/finance/financeWap/detail',{productId:v.productId},{httpsAgent:agent,timeout:3000})).data.data
		
				if(resDtl.yieldType=='近一月年化收益') newRow.irM1 = parseFloat(resDtl.yieldValue.slice(0,-1))
				else
				for(let y of resDtl.historicalYieldList){//各期限收益率
					const t = timeIntervalMap[y.timeInterval]
					if(t) newRow['ir'+t] = parseFloat(y.yeildValue.slice(0,-1))
					if(y.timeInterval=='成立以来') newRow.startDate = y.performanceCycle.slice(0,10)
				}
				break //查询成功
			}catch(e){
				console.log('工行]查询失败...延时重试',e.message)
				await sleep(sleepMs)
				sleepMs *= 2
			}
		}
	}
	
	
	//return invList
	
	//console.log('Saved2File!')
}

//建行
async function getCcbData(){
	//////////////////////////////////////////
	/*res=await axios.get('https://finance1.ccb.com/tran/WCCMainPlatV5?CCB_IBSVersion=V5&SERVLET_NAME=WCCMainPlatV5&TXCODE=NLCQ11&Fcn_Cd=0&REC_IN_PAGE=999&PAGE_JUMP=1&Sel_StCd=9&Txn_BO_ID=330000000&Chnl_ID=10060009&FndCo_Agnc_Sale_InsID=005&Crt_Chnl_ID=9999999999&PD_Sl_Obj_Cd=01&Bkstg_PD_Tp_ECD=01')
	for(let v of res.data.PROD_INFO_GRP)
		invTab.push({bank:'建行',name:v.Fnd_Nm,risk:v.Rsk_Grd_Cd,ir:v.Exg_Pft_Cmnt,manager:v.Co_Nm,startDate:str2date8(v.Inpt_SrtDt),startDate:str2date8(v.Rs_EdDt)})
	*/
}

async function getAll(){
	await Promise.all([getBocData(), getIcbcData()]);
	fs.writeFileSync(path.join(__dirname, 'pub/bknv.json'),JSON.stringify(invTab),'utf-8')
}

//getAll()
getBocData()


/*

//工行链接列表页https://m.icbc.com.cn/mpage/finance/list
fetch("https://papi.icbc.com.cn/finance/financeWap/searchList", {
  "headers": {
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    "content-type": "application/json",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-tag-papi": "gray"
  },
  "referrer": "https://m.icbc.com.cn/mpage/finance/list",
  "body": "{\"searchInfo\":\"\",\"curr\":\"人民币\",\"term\":\"\",\"type\":\"\",\"rile\":\"00002\",\"utty\":\"\",\"pageIndex\":1,\"pageSize\":999}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});

*/
//
//建行