const axios = require('axios')
const fs = require('fs')
const path=require('path')
const cheerio = require('cheerio')

let d = new Date()
const yyyy=d.getFullYear(),mm = String(d.getMonth() + 1).padStart(2, '0'),dd= String(d.getDate()).padStart(2, '0');

function fromBase64(bstr){return Buffer.from(bstr, 'base64').toString('utf-8')}

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
		//nodefreeUrl()
		`https://node.nodefree.me/${yyyy}/${mm}/${yyyy}${mm}${dd}.txt`,
		'https://github.com/Alvin9999-newpac/fanqiang/wiki/v2ray%E5%85%8D%E8%B4%B9%E8%B4%A6%E5%8F%B7',
		'https://raw.githubusercontent.com/free-nodes/v2rayfree/main/README.md',
		`https://node.hysteria2.org/uploads/${yyyy}/${mm}/0-${yyyy}${mm}${dd}.txt`,
		`https://node.hysteria2.org/uploads/${yyyy}/${mm}/1-${yyyy}${mm}${dd}.txt`
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

	//////////////包含节点URL的普通html(如vless|trojan://....)
	const htmlPages=[
		'https://github.com/Alvin9999-newpac/fanqiang/wiki/v2ray%E5%85%8D%E8%B4%B9%E8%B4%A6%E5%8F%B7',
		'https://raw.githubusercontent.com/free-nodes/v2rayfree/main/README.md'
	]

	/*for(const u of htmlPages){
		try{
			let allurls = 
			for(const u1 of allurls)
				if(!u1.startsWith('http'))
					allTxt += u1.trim()+'\n'

			console.log(u,'解析后', allTxt.length)
		}
		catch (error) {console.error(u,'html解析节点链接失败:', error.message);}
	}
	*/
	
	//fs.writeFileSync(path.join(process.cwd(),'v'), Buffer.from(allTxt.trim()).toString('base64'));
	fs.writeFileSync('v', Buffer.from(allTxt.trim()).toString('base64'));
}

updateList()
