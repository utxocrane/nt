const axios = require('axios')
const fs = require('fs')
const path=require('path')
const cheerio = require('cheerio')
const v2uri = require('./lib/v2uri')
//const {SocksProxyAgent} = require('socks-proxy-agent')
//const socksAgent = new SocksProxyAgent('socks://127.0.0.1:10808') //走代理

let d = new Date()
const yyyy=d.getFullYear(),mm = String(d.getMonth() + 1).padStart(2, '0'),dd= String(d.getDate()).padStart(2, '0');

function safeJson(s){return JSON.parse(s)}//暂代
function fromBase64(bstr){return Buffer.from(bstr.trim(), 'base64').toString('utf-8')}

function extractUrlsSmart(html) {
  const $ = cheerio.load(html);
  const urlPattern = /[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^\s"'<>]+/g;
  
  // 先移除所有不希望提取内容的标签
  $('script, style, noscript').remove();
  
  // 获取所有文本内容
  const text = $('body').text();
  
  // 提取URL并去重
  const urls = [...new Set(text.match(urlPattern) || [])];
  
  return urls;
}

async function updateData() {
	let allTxt = '',allLogs=''
	/////////////////普通base64订阅链接或包含节点URL的纯文本，按是否包含:判断是否需要base64解码
	const suburls=[
		'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub',
		'https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.txt',
		'https://raw.githubusercontent.com/snakem982/proxypool/main/source/v2ray-2.txt',
		'https://raw.githubusercontent.com/Barabama/FreeNodes/main/nodes/yudou66.txt',
		'https://www.xrayvip.com/free.txt',
		`https://node.nodefree.me/${yyyy}/${mm}/${yyyy}${mm}${dd}.txt`,
		'https://github.com/Alvin9999-newpac/fanqiang/wiki/v2ray%E5%85%8D%E8%B4%B9%E8%B4%A6%E5%8F%B7',
		'https://raw.githubusercontent.com/free-nodes/v2rayfree/main/README.md',
		`https://node.hysteria2.org/uploads/${yyyy}/${mm}/0-${yyyy}${mm}${dd}.txt`,`https://node.hysteria2.org/uploads/${yyyy}/${mm}/1-${yyyy}${mm}${dd}.txt`//https://hysteria2.org/free-node/2026-2-27-free-clash-subscribe.htm
		
		//https://raw.githubusercontent.com/adiwzx/freenode/main/adispeed.txt //这个自ID-10086/freenode导流的订阅已全部失效，后续再跟踪
		//crossxx-labs/free-proxy是clash格式订阅，看看有无免费转换方案
	]

	suburls.push(...(await loadYudou())) //玉豆
	
	for(const u of suburls){
		try{
			allLogs += '开始加载'+u+'\n'
			let d = (await axios.get(u)).data
			
			let txt1 = ''
			if(d.indexOf(':/')<0) txt1 = fromBase64(d) //base64订阅直接解码
			else for(const u1 of extractUrlsSmart(d)) if(!u1.startsWith('http'))txt1 += u1.trim()+'\n' //解析所有URL
			
			txt1 = txt1.trim()
			allLogs += txt1 + '\n'
			allTxt += txt1 + '\n'

			console.log(u,'读取后长度', allTxt.length);
		}
		catch (error) {console.error(u,'读取失败:', error.message);}
	}

	allTxt = allTxt.trim()
	fs.writeFileSync('vsrc', Buffer.from(allTxt).toString('base64')) //原始完整列表

	let uniList={},allcnt=0
	for(let urlstr of allTxt.split('\n')){
		uniList[new v2uri(urlstr).FP] = urlstr
		++allcnt
	}

	allTxt = '',ucnt=0
	for(let h in uniList){
		allTxt += uniList[h]+'\n'
		++ucnt
	}

	console.log('总数', allcnt,'去重后',ucnt)
	fs.writeFileSync('vt', allTxt) //订阅明文
	fs.writeFileSync('v', Buffer.from(allTxt).toString('base64')) //去重后的订阅
	fs.writeFileSync('l', allLogs) //日志

	////////////////////////////////金融数据
	let allTickers=[]
	
	for(let tx of (await axios.get('https://www.okx.com/api/v5/market/tickers?instType=SPOT')).data.data)
		if(tx.instId.endsWith('USD') || tx.instId.endsWith('USDT')) allTickers.push(tx)
	
	fs.writeFileSync('m',JSON.stringify(allTickers))
	console.log('OKX USD报价',allTickers.length)
}

updateData()

async function loadYudou(){
	let returls=[]
	try{
		let $=cheerio.load((await axios.get('https://www.yudou789.top/category/jiedian')).data)
		for(let p of $('posts')){
			let $2 = cheerio.load((await axios.get(p.children[1].children[0].children[0].attribs.href)).data)
			
			const matches = ($2('body').text().match(/https:\/\/hh\.yudou226\.top\/[^\/]+\/[^\/]+\.txt/g)) || [];
			for(let u of matches) returls.push(u)
		}

		return returls
	}catch(e){console.error(u,'玉豆加载失败:', e.message);return []}
}
