const axios=require('axios')
const fs=require('node:fs')
const path=require('node:path')
const https=require('node:https')

const dataPath = path.join(__dirname, 'pub/bknv.json')
	,orgDataPath = path.join(__dirname, 'pub/orgdtl.json')//const a=JSON.parse(require('node:fs').readFileSync('orgdtl.json','utf-8'))//独立分析

if(process.env.RUNLOCAL){//本地运行时，启动http服务
	const express = require('express')
	const app = express()
	app.use('/', express.static(path.join(__dirname, 'pub')))
	require('http').createServer(app).listen(3000,() => console.log('http://127.0.0.1:3000 started'))
}

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

//更新git
const giteeToken=process.env.GITEETOKEN
const giteeUrl=process.env.GITEEURL
async function updateGiteeReadme(content) {
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    try {
        // --- 第1步：获取文件的 sha（删除前必须） ---
        console.log('🔍 正在获取文件信息...');
        const getResp = await axios.get(giteeUrl, {
            params: { access_token:giteeToken }
        });
        const sha = getResp.data.sha;
        console.log(`✅ 获取到 SHA: ${sha}`);

        // --- 第2步：删除文件 ---
        console.log('🗑️ 正在删除原文件...');
        await axios.delete(giteeUrl, {
            data: {
                access_token: giteeToken,
                sha: sha,
                message: '删除文件以便重建'
            }
        });
        console.log('✅ 删除成功');

        // --- 第3步：重新创建文件 ---
        console.log('📝 正在创建新文件...');
        const createResp = await axios.post(giteeUrl, {
            access_token: giteeToken,
            content: base64Content,
            message: 'via api'
        });
        console.log('✅ 文件创建成功！');
        console.log(`📁 链接: ${createResp.data.content.html_url}`);

    } catch (error) {
        console.error('❌ 操作失败:');
        if (error.response) {
            console.error(`状态码: ${error.response.status}`);
            console.error(`错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(error.message);
        }
    }
}

let invTab=[]//归一化数据在这里
let originData={} // 抓取的原始数据

//中行数据
async function getBocData(){
	let reqbody = {"header":{"agent":"X-ANDR","version":"3.1.9","device":"android","platform":"android","plugins":"5","page":"6","local":"zh_CN","uuid":"1784441108674129532660","ext":"8","cipherType":"0","appSequence":""},"method":"PsnxWmpNewProductListQueryOutlay","params":{"pageSize":"14","currentIndex":"0","subChannelId":"31","productType":"03","raiseMethod":"PUB","wmpmFirstClass":"QBLC","queryIsNewLine":"1","wmpmPeriodFlag":"","currencySign":"CNY","riskLevel":"R1,R2","startAmount":"","managerCode":"","queryOption":"","sortType":"0","sortField":"4","productSaleStatus":"","isQredeem":"","isPREF":"","wmpmSecondFlag":"","isRaisingEndDate":"","indiCustomerLevel":""}}
	const pageSize=14,maxStartIndex=1400 //中行数据需分页读取，测试，只搞1页
	
	const invList=[]
	for(let si=0;si<=maxStartIndex;si+=pageSize){
		reqbody.params.currentIndex = ""+si
		let res = await axios.post(process.env.BOCLSTURL,'json='+encodeURI(JSON.stringify(reqbody)))
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
		let res = await axios.post(process.env.BOCDTLURL,'json='+encodeURI(JSON.stringify(reqbody)))
		for(let r of res.data.result.list) v['ir'+r.incomerateDisplayFeature] = parseFloat(r.incomeRatio)||0

		invTab.push({bank:'中行',id:v.productId,name:v.productName,lockDays:v.periodTerm||1,manager:v.managerShortName,risk:parseInt(v.riskLevel.slice(1,2)),startDate:new Date(v.yieldStartDate).getTime(),lastDate:new Date(v.yieldEndDate).getTime(),irM1:v.irM1||0,irM3:v.irM3||0,irM6:v.irM6||0,ir:v.irYE||v.newYield||0,irYE:v.irYE,restAmt:restAmt })
		originData[v.productId] = res.data
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
	let res = await axios.post(process.env.ICBCLSTURL,reqbody,{
		headers: {
		'Content-Type': 'application/json',
		'x-tag-papi': 'gray'
		},
		httpsAgent:agent
	})
	res = res.data.data.list
	//console.log('工行总记录数',)
	for(let [i,v] of res.entries()){
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
				let resDtl = (await axios.post(process.env.ICBCDTLURL,{productId:v.productId},{httpsAgent:agent,timeout:3000})).data.data
				originData[v.productId] = resDtl //记录数据用于分析
				if(resDtl.yieldType=='近一月年化收益') newRow.irM1 = parseFloat(resDtl.yieldValue.slice(0,-1))
				
				if(resDtl.historicalYieldList)//阶段收益率
				 for(let y of resDtl.historicalYieldList){//各期限收益率
					const t = timeIntervalMap[y.timeInterval]
					if(t) newRow['ir'+t] = parseFloat(y.yeildValue.slice(0,-1))
					if(y.timeInterval=='成立以来' && y.performanceCycle.length>12){
						newRow.startDate = new Date(y.performanceCycle.slice(0,10)).getTime()
						newRow.lastDate = new Date(y.performanceCycle.slice(-10)).getTime()
					}
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

function sendTopx2Gitee(){
	let s='',maxi=100,minirm3=3,minirm6=3,minirye=3,maxlockdays=30 // 多周期筛选

	for(let v of invTab){
		if(v.risk>2 || v.lockDays>maxlockdays || v.irM3 && v.irM3<minirm3 || v.irM6 && v.irM6<minirm6 || v.irYE && v.irYE<minirye) continue
		if(--maxi<1) break

		s += (Number(v.irM1)?.toFixed(2) ?? '0') + '\t' + (Number(v.irM3)?.toFixed(2) ?? '0') + '\t' + (Number(v.irYE)?.toFixed(2) ?? '0') + '\t' + v.bank  + v.id + '\n'
	}
	
	updateGiteeReadme(s)
}

async function getAll(){
	await Promise.all([getBocData(), getIcbcData()]);
	invTab.sort((a, b) => {//以近1月收益率排序（考虑到部分新发产品可能没有3月、6月等数据）
		const va = typeof a.irM1 === 'number' && isFinite(a.irM1) ? a.irM1 : -Infinity;
		const vb = typeof b.irM1 === 'number' && isFinite(b.irM1) ? b.irM1 : -Infinity;
		return vb - va;
	});
	fs.writeFileSync(dataPath,JSON.stringify(invTab),'utf-8')
	fs.writeFileSync(orgDataPath,JSON.stringify(originData),'utf-8')
	sendTopx2Gitee()
}

function isModifiedToday(filePath) {
  try{
  const stats = fs.statSync(filePath)
  const mtime = new Date(stats.mtimeMs); // 或直接 new Date(stats.mtime)

  const today = new Date();
  console.log('系统时间',today,'数据文件更新时间',mtime)
  // 判断是否同一年、同一月、同一日
  return mtime.getFullYear() === today.getFullYear() &&
         mtime.getMonth() === today.getMonth() &&
         mtime.getDate() === today.getDate();
  }catch(e){
	  console.log('当日记录可能不存在',e)
	  return false
  }
}

if(!isModifiedToday(dataPath) || !process.env.RUNLOCAL) getAll() //每天只执行1次更新
else console.log('今日已抓取过数据，不再重复抓取')