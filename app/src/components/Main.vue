<template>
  <div class="main">
    <div class="container vrmviewContainer">
      <FileUpload :changeFile="changeFile" />
      <VRMView ref="vrmview" :path="path" :debug="false" />
      <div>
        <label for="btnExport">{{$t('btnExport')}}</label>
        <input id="btnExport" type="button" @click="clickExport" />
      </div>
    </div>
    <div class="container vrmparserContainer">
      <VRMParserView ref="vrmparser" :drawVrm="drawVrm" :drawFirstPerson="drawFirstPerson" />
    </div>
</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

import VRMView from '@/components/VRMView.vue'
import FileUpload from '@/components/FileUpload.vue'
import VRMParserView from '@/components/VRMParserView.vue'

@Component({
  components: {
    VRMView,
    FileUpload,
    VRMParserView
  } 
})
export default class Main extends Vue {
  path = "./res/pk03.vrm"

  // アップロードされたファイル
  selectVrmFile?: File | null = null

  mounted() {
    // VRM 読み込み
    const vrmview = this.$refs.vrmview as VRMView
    vrmview.drawVrm( this.path )
      .then(() => {
        fetch(this.path)
          .then((res) => res.blob())
          .then(blob => {            
            // VRMパース
            const vrmparser = this.$refs.vrmparser as VRMParserView    
            vrmparser.parse( new File([blob], 'vrm') )
          })
      })
      .catch((e) => {
        console.log(e)
      })
  }

  changeFile(event: any) {
    console.log('changeFile', event)
    this.selectVrmFile = event.target.files[0]
    // VRM 読み込み
    this.drawVrm( this.selectVrmFile! )
  }

  clickExport() {
    const vrmparser = this.$refs.vrmparser as VRMParserView
    vrmparser.downloadFile()
  }

  drawVrm(file: File) {
    const vrmview = this.$refs.vrmview as VRMView
    vrmview.drawVrm( file )
      .then(() => {
          // VRMパース
          const vrmparser = this.$refs.vrmparser as VRMParserView    
          vrmparser.parse( file )
            .then((json) => {
              // カメラ位置を調整する
              vrmview.setCameraTarget(json);
            })
        })
        .catch((e) => {
          console.log(e)
        })
  }

  drawFirstPerson(vrmJson: any) {
    const vrmview = this.$refs.vrmview as VRMView
    vrmview.drawFirstPerson(vrmJson)
  }
}
</script>

<style scoped lang="scss">
  .main {
    display: flex;
    justify-content: center;
    /* width: 915px; */
    margin: 0 auto;
    /* background-color: aqua; */
    .container {
      /* width: 300px; */
      width: 100%;

      label {
        font-size: large;
        border: solid 3px #AAAAAA;
        background-color: #F0F0F0;
        display: block;
        width: 90%;
        margin: 5px auto;
        transition: .3s;
      }
      label:hover {
        background-color: #AAAAAA;
      }
      input[type="button"] {
        /* font-size: large; */
        display:none; 
      }
    }
  }
  
  @media screen and (max-width: 480px) { 
    .main {
      flex-direction: column;
      .container {
        width: 300px;
        margin: 0 auto;
      }
    }
  }

  /*
  @media screen and (max-width: 767px) {
    .main {
      flex-direction: column;

      .container {
        width: 100%;
      }
    }
  }
  */
</style>
