const axios = require('axios')
const fs = require('fs')
const path=require('path')
const cheerio = require('cheerio')

let d = new Date()
const yyyy=d.getFullYear(),mm = String(d.getMonth() + 1).padStart(2, '0'),dd= String(d.getDate()).padStart(2, '0');

function fromBase64(bstr){return Buffer.from(bstr, 'base64').toString('utf-8')}
function safeJson(s){return JSON.parse(s)}//暂代
function fromBase64(bstr){return Buffer.from(bstr.trim(), 'base64').toString('utf-8')}
function url2std(urlstr){//转为中间格式
	let u = new URL(urlstr.replaceAll('&amp;','&').trim())

	let ob = {protocol:u.protocol.slice(0,-1)}
	
	//vmess是json的base64编码
	if(ob.protocol == 'vmess'){
		let vj = safeJson(atob(urlstr.slice(8)))
		
		Object.assign(ob, {
			hostname:vj.add,
			port:vj.port,
			username:vj.id,
			scy:vj.scy||'auto',
			aid:vj.aid ? parseInt(vj.aid):0,
			hash:vj.ps,
			net:vj.net,
			path:vj.path,
			host:vj.host
		})
	}else{//普通格式协议
		[ob.hostname,ob.port,ob.hash,ob.username] = [u.hostname,u.port,decodeURI(u.hash.slice(1)),u.username];
		for (let [k, v] of u.searchParams)
			if(v&&v.length>0) ob[k] = v

	}
	
	//修正数据格式、默认值等
	ob.port = parseInt(ob.port)
	try{ob.alpn = ob.alpn.split(',')}catch{}
	if(ob.protocol == 'ss'){
		ob.protocol = 'shadowsocks';
		[ob.method,ob.password] = fromBase64(u.username).split(':');
	}

	return ob
}

function djb2Hash(str) {
  let hash = 5381;
  
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  
  hash = hash >>> 0; // 确保为正数
  
  // 转换为8位十六进制，不足补零
  return hash.toString(16).padStart(8, '0');
}
const hashBy = ['protocol','hostname','port','username','sni','flow','pbk','type','sid','path','host','fp','net','serviceName','security','alpn']
function getStdNodeHash(ob){//标准obj指纹
	let str=""
	for(p of hashBy) if(ob[p]) str+=JSON.stringify(ob[p])

	return djb2Hash(str)
}
function getUrlHash(urlstr){//URL指纹
	return getStdNodeHash(url2std(urlstr))
}


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

async function updateList() {
	let allTxt = ''
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
	
	for(const u of suburls){
		try{
			let d = (await axios.get(u)).data
			if(d.indexOf(':/')<0) allTxt += fromBase64(d).trim()+'\n' //直接解码
			else for(const u1 of extractUrlsSmart(d)) allTxt += u1.trim()+'\n' //解析所有URL
			
			console.log(u,'读取后', allTxt.length);
		}
		catch (error) {console.error('u读取失败:', error.message);}
	}

	allTxt = allTxt.trim()
	//fs.writeFileSync(path.join(process.cwd(),'v'), Buffer.from(allTxt.trim()).toString('base64'));
	fs.writeFileSync('v', Buffer.from(allTxt).toString('base64')) //完整列表

	let uniList={}
	for(let urlstr of allTxt.split('\n'))
		uniList[getUrlHash(urlstr)] = urlstr

	allTxt = ''
	for(let h in uniList) allTxt += uniList[h]+'\n'

	fs.writeFileSync('vu', Buffer.from(allTxt).toString('base64')) //去重后
}

updateList()
