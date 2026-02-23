const axios = require('axios')
const fs = require('fs')
const path=require('path')

async function updateList() {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/free-nodes/v2rayfree/main/README.md')
		let txt = response.data
		let si = txt.indexOf('```')+4,ei = txt.lastIndexOf('```')
		myOldTxt = txt.substr(si,ei-si).trim().replaceAll('&amp;','&')
	  	fs.writeFileSync(path.join(process.cwd(),'v'), Buffer.from(myOldTxt).toString('base64'));
	    console.log('订阅长度'+myOldTxt.length)
  } catch (error) {
    console.error('请求失败:', error.message);
  }
}

updateList()
