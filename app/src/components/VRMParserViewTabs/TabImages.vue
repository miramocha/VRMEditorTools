<template>
    <div class="tabContents tabImages" v-if="selectTabType == 'tab_images'">
      <table class="table">
        <thead>
          <tr>
            <th>
              <p>Name</p>
              <p>Image</p>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="img,i in vrmImages" :key="i">
            <td class="tableDetail">
              <p>{{img.name}}</p>
              <table>
                <tbody>
                  <tr>
                    <td>
                      <img class="src_thumbnail" :src="img.src" :alt="img.name"/>
                    </td>
                    <td>
                      <p><button @click="exportImage(img)">{{$t('exportImage')}}</button></p>
                      <p><button @click="importImage(img)">{{$t('importImage')}}</button></p>
                    </td>
                  </tr>                
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
</template>
<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator'
import VRMParser from '@/module/VRMParser'

@Component
export default class TabImages extends Vue {
    @Prop() 
    drawVrm: (file: File) => void

    @Prop()
    selectTabType: string;

    @Prop()
    vrmImages: any;

    // 画像ファイル ダウンロード
    exportImage(img: any) {
        console.log('exportImage', img)

        const link = document.createElement('a')
        link.href = img.src
        link.download = img.name
        link.click()
    }

    // 画像ファイル差し替え
    importImage(img: any) {
        console.log('importImage', img)
        // ファイル選択
        let input = document.createElement('input')
        input.type = 'file'
        input.onchange = (event: any) => {
        console.log('files', event.currentTarget.files[0])
        const file = event.currentTarget.files[0]

        const fileReader = new FileReader()
        fileReader.onload = (event: any) => {
            const raw: ArrayBuffer = event.currentTarget.result

            // VRM 内の画像ファイルを置き換える
            VRMParser.replaceImage(img, raw)
            .then(() => {
                // VRM情報が更新されている
                console.log('replaceImage success')

                VRMParser.createVRMFile()
                .then((file: File) => {
                    // console.log('file', file)

                    //画像一覧の更新
                    VRMParser.parse(file, (json: any, images: any[]) => {
                    this.vrmImages.splice(0, this.vrmImages.length)
                    this.vrmImages.push(...images)
                    console.log('vrmImages', this.vrmImages)
                    })
                    
                    // VRMView 描画の更新
                    if (this.drawVrm) {
                    this.drawVrm(file)
                    }
                })
                .catch(e => {
                    console.error('error', e)
                })
            })
            .catch( e => {
                console.error('error', e)
            })
        }
        fileReader.readAsArrayBuffer(file)
        }
        input.click()
    }   
}
</script>

<style scoped lang="scss">

.table {
  margin: 0 auto;
  width: 100%;
  /* border: 1px black solid; */
}
.table thead {
  background-color: lightslategray;
  height: 60px;
}

.table thead p, .table tbody p {
  margin: 5px auto;
  text-align: left;
}

.src_thumbnail {
  display: block;
  width: 60px;
  margin: 0 auto;
}

.tableDetail {
  border-bottom: 1px black solid;
  .title {
    width: 80px;
  }
}

</style>

<style scoped lang="scss">
/*
table {
  width: 100%;
  table-layout: fixed;
  word-break: break-all;
  word-wrap: break-all;
}

.tabImages {
  .table {
    margin: 0 auto;
    width: 100%;
  }
  .table thead {
    background-color: lightslategray;
    height: 60px;
  }
  .table thead p, .table tbody p {
    margin: 5px auto;
    text-align: left;
  }

  .table tbody tr {
    border: 1px black solid;
  }

  .table tbody p button {
    width: 120px;
  }

  .src_thumbnail {
    display: block;
    width: 60px;
    margin: 0 auto;
  }
  .tableDetail {
    border-bottom: 1px black solid;
    .title {
      width: 80px;
    }
  }
}
*/
</style>
