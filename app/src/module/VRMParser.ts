import { async } from "@firebase/util"

/** VRMParser
 *  VRMの解析とテクスチャ置き換え等の機能をもつ
 * 
 *  Copyright (c) 2022 Nobuyuki Furukawa (tfuru)
 *  This software is released under the MIT License, see LICENSE.
 */
class VRMParser {
    /* * ファイルフォーマット ドキュメント
    * glTF2.0 glb フォーマット
    * https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification
    * 
    * VRM 0.0 フォーマット
    * https://github.com/vrm-c/vrm-specification/blob/master/specification/0.0/README.ja.md 
    */

    static IS_LITTLE_ENDIAN = true
    static GLB_HEADER_MAGIC = 0x46546C67
    static CHUNK_TYPE_JSON = 0x4E4F534A
    static CHUNK_TYPE_BIN = 0x004E4942

    static CHUNK_HEADER_SIZE = 12
    static CHUNK_LENGTH_SIZE = 4
    static CHUNK_TYPE_SIZE = 4

    static json?: any
    static images: any[] = []

    static filename?: string
    static header?: any
    static jsonChunk?: any
    static binaryChunk?: any

    static callback: (json: any, images: any[]) => void

    /**
     * Entry point
     * @param file 
     * @param callback 
     */
    public static parse = (file: File, callback: (json: any, images: any[]) => void) => {
        console.log('parse', file)
        VRMParser.filename = file.name
        VRMParser.callback = callback;

        const reader = new FileReader()
        reader.onload = VRMParser.onLoadVRMFile
        reader.readAsArrayBuffer(file)
    }

    private static onLoadVRMFile = async (event: any) => {
        // console.log('onLoadVRMFile', event)
        // console.log('total', event.total)        
        const raw: ArrayBuffer = event.currentTarget.result
        // DataView バイナリデータ読み書きオブジェクト - binary data read/write object
        const src = new DataView(raw)
        // Header, Chunks を取り出す
        // Header 12-byte
        VRMParser.header = VRMParser.parseHeader(src)
        // console.log('magic', header.magicToStr)

        // Magic MUST be equal to equal 0x46546C67. It is ASCII string glTF and can be used to identify data as Binary glTF.
        if (VRMParser.header.magic != VRMParser.GLB_HEADER_MAGIC) {
            console.warn('File is not GLB file');
            return;
        }

        console.log('magic', VRMParser.toHexStr(VRMParser.header.magic))
        console.log('version', VRMParser.header.version)
        console.log('length', VRMParser.header.length)

        // Chunks 0 を jsonとしてパース
        VRMParser.jsonChunk = VRMParser.parseJsonChunk(src, VRMParser.CHUNK_HEADER_SIZE)
        if (typeof VRMParser.jsonChunk == 'undefined') {
            return
        }
        console.log('jsonChunk', VRMParser.jsonChunk)
        VRMParser.json = VRMParser.jsonChunk.json
        console.log('EXTENSIONS', VRMParser.json.extensions)

        // Chunks 1 を 取得
        const binaryChunkOffset = VRMParser.CHUNK_HEADER_SIZE
            + VRMParser.CHUNK_LENGTH_SIZE
            + VRMParser.CHUNK_TYPE_SIZE
            + VRMParser.jsonChunk.chunkLength
        VRMParser.binaryChunk = VRMParser.parseBinaryChunk(src, binaryChunkOffset)
        if (typeof VRMParser.binaryChunk?.chunkData == 'undefined') {
            return
        }
        console.log('binaryChunk', VRMParser.binaryChunk)

        // テクスチャを取り出す images, bufferViews
        VRMParser.loadImages(VRMParser.binaryChunk.chunkData, VRMParser.json)
            .then(images => {
                VRMParser.images = images
                console.log('images', VRMParser.images)

                // コールバックする
                VRMParser.callback(VRMParser.json, VRMParser.images)
            })
            .catch(e => {
                console.error('e', e)
            })

        
    }

    private static toHexStr = (value: number) => {
        return '0x' + value.toString(16).toUpperCase()
    }

    /* Header 12-byte
    uint32 magic
    uint32 version
    uint32 length
    */
    private static parseHeader = (src: DataView) => {
        console.log('src', src)
        const magic = src.getUint32(0, VRMParser.IS_LITTLE_ENDIAN)
        const version = src.getUint32(4, VRMParser.IS_LITTLE_ENDIAN)
        const length = src.getUint32(8, VRMParser.IS_LITTLE_ENDIAN)
        return { magic, version, length }
    }

    /* Chunks
    uint32 chunkLength
    uint32 chunkType
    ubyte[] chunkData
    */
    private static parseChunk = (type: number, src: DataView, offset: number) => {
        console.log('parseChunk', src, offset)
        const chunkLength = src.getUint32(offset, VRMParser.IS_LITTLE_ENDIAN)
        const chunkType = src.getUint32(offset + VRMParser.CHUNK_LENGTH_SIZE, VRMParser.IS_LITTLE_ENDIAN)
        if (type != chunkType) {
            console.warn('not JSON.');
            return;
        }

        // データを取り出す
        const chunkData = new Uint8Array(src.buffer,
            offset + VRMParser.CHUNK_LENGTH_SIZE + VRMParser.CHUNK_TYPE_SIZE,
            chunkLength)

        return { chunkLength, chunkData }
    }

    // JSON 部分を取り出す 
    private static parseJsonChunk = (src: DataView, offset: number) => {
        console.log('parseJsonChunk', src, offset)
        const chunk = VRMParser.parseChunk(VRMParser.CHUNK_TYPE_JSON, src, offset)

        if (typeof chunk == 'undefined') {
            return
        }

        const chunkLength = chunk.chunkLength
        const chunkData = chunk.chunkData

        const decoder = new TextDecoder("utf8")
        const jsonText = decoder.decode(chunk.chunkData)
        const json = JSON.parse(jsonText)

        return { chunkLength, chunkData, json }
    }

    // バイナリ部分を取り出す  
    private static parseBinaryChunk = (src: DataView, offset: number) => {
        console.log('parseBinaryChunk', src, offset)
        const chunk = VRMParser.parseChunk(VRMParser.CHUNK_TYPE_BIN, src, offset)
        if (typeof chunk == 'undefined') {
            return
        }
        const chunkLength = chunk.chunkLength
        const chunkData = chunk.chunkData

        return { chunkLength, chunkData }
    }

    // テクスチャを取り出す images, bufferViews
    private static loadImages = (chunkData: ArrayBuffer, json: any): Promise<any[]> => {
        // console.log('loadImages', json.images)
        // console.log('chunkData', chunkData)

        return new Promise((resolve, reject) => {
            const images: any[] = []
            if (json.images.length == 0) {
                resolve(images)
                return
            }
            json.images
                .forEach((v: any) => {
                    const bufferView = json.bufferViews[v.bufferView]
                    // new Uint8Array はうまく動作しない
                    // const buf = new Uint8Array(chunkData, bufferView.byteOffset, bufferView.byteLength)
                    const buf = chunkData.slice(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength)
                    const blob = new Blob([buf], { type: v.mimeType })

                    const img = URL.createObjectURL(blob)
                    images.push({
                        index: v.bufferView,
                        name: v.name,
                        mimeType: v.mimeType,
                        src: img,
                        size: blob.size
                    })
                })
            resolve(images)
        })
    }

    // json(jsonChunk), binaryChunk を再構築する
    public static chunkRebuilding = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            // json.buffers[0].byteLength も更新
            VRMParser.json.buffers[0].byteLength = VRMParser.binaryChunk.chunkLength

            // console.log('bufferViews', VRMParser.json.bufferViews)
            // jsonChunk を更新
            VRMParser.jsonChunk.json = VRMParser.json
            VRMParser.jsonChunk.chunkData = new TextEncoder().encode(JSON.stringify(VRMParser.json))
            VRMParser.jsonChunk.chunkLength = VRMParser.jsonChunk.chunkData.length
            console.log('jsonChunk', VRMParser.jsonChunk)

            // headerの length も更新
            VRMParser.header.length = VRMParser.CHUNK_HEADER_SIZE
                + VRMParser.CHUNK_LENGTH_SIZE
                + VRMParser.CHUNK_TYPE_SIZE
                + VRMParser.jsonChunk.chunkLength
                + VRMParser.CHUNK_LENGTH_SIZE
                + VRMParser.CHUNK_TYPE_SIZE
                + VRMParser.binaryChunk.chunkLength

            console.log('header', VRMParser.header)

            resolve()
        })
    }

    // テクスチャを置き換えて json(jsonChunk), binaryChunk を再構築する
    public static replaceImage = (img: any, fileBuf: ArrayBuffer): Promise<void> => {
        console.log('replaceImage', img, fileBuf)

        return new Promise((resolve, reject) => {

            const chunkData = VRMParser.binaryChunk.chunkData
            const distChunkDataList: any[] = []
            let byteOffset = 0;
            VRMParser.json.bufferViews.forEach((bufferView: any, index: number) => {
                // console.log('bufferViews', bufferView)
                const buf = chunkData.slice(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength)
                const blob = new Blob([buf])
                // console.log('blob', blob)
                distChunkDataList.push({
                    index: index,
                    byteOffset: byteOffset,
                    byteLength: blob.size,
                    blob: blob,
                    src: buf
                })
                byteOffset += blob.size
            })
            // console.log('images', VRMParser.json.images)
            // index が 一致する json.images を取り出す
            let image = VRMParser.json.images[img.index]
            if (typeof image == 'undefined') {
                // 名前が一致する json.images を取り出す
                image = VRMParser.json.images.filter((v: any) => (v.name == img.name))[0]
            }
            console.log('-- image', image)

            // console.log('image', image)
            const distChunkDataListIndex = image.bufferView

            // distChunkDataList distChunkDataListIndex の位置の blob を file 書き換える
            distChunkDataList[distChunkDataListIndex].byteLength = fileBuf.byteLength
            distChunkDataList[distChunkDataListIndex].blob = new Blob([fileBuf])
            distChunkDataList[distChunkDataListIndex].src = new Uint8Array(fileBuf)

            // distChunkDataList byteOffset を書き換える
            byteOffset = 0;
            distChunkDataList.forEach((v: any, i: number, src: any[]) => {
                src[i].byteOffset = byteOffset
                byteOffset += v.byteLength
            })
            console.log('distChunkDataList', distChunkDataList)

            // distChunkDataList を元に binaryChunk を作成する
            // byteOffset は byteLength            
            VRMParser.binaryChunk.chunkData = new Uint8Array(byteOffset)
            distChunkDataList.forEach((v: any) => {
                VRMParser.binaryChunk.chunkData.set(v.src, v.byteOffset)
            })
            VRMParser.binaryChunk.chunkLength = VRMParser.binaryChunk.chunkData.length
            console.log('binaryChunk', VRMParser.binaryChunk)

            // json.bufferViews 位置の byteOffset, byteLength 書き換え
            VRMParser.json.bufferViews.forEach((v: any, i: number, src: any[]) => {
                const data = distChunkDataList[i]
                src[i].byteLength = data.byteLength
                src[i].byteOffset = data.byteOffset
            })

            // json(jsonChunk), binaryChunk を再構築する
            return VRMParser.chunkRebuilding()
                .then(() => {
                    resolve()
                })
                .catch(e => {
                    console.error('error', e)
                })
        })
    }

    // 一人称視点の視点のオフセット位置を取得
    // json.extensions.VRM.firstPerson
    public static getFirstPersonBone = (): { firstPerson: any } => {
        let extVRM = VRMParser.json.extensions.VRM
        if (extVRM) {
            console.warn('NOT VRM 0, attempting to parse VRM1.0');
            extVRM = VRMParser.json.extensions.VRMC_vrm
        }
        console.log('extVRM', extVRM)
        console.log('firstPerson', extVRM.firstPerson)
        return extVRM.firstPerson
    }

    // 一人称視点の視点のオフセット位置を設定
    public static setFirstPersonBoneOffset = (position: { x: number, y: number, z: number }): Promise<void> => {
        return new Promise((resolve, reject) => {
            const extVRM = VRMParser.json.extensions.VRM
            extVRM.firstPerson.firstPersonBoneOffset.x = position.x
            extVRM.firstPerson.firstPersonBoneOffset.y = position.y
            extVRM.firstPerson.firstPersonBoneOffset.z = position.z

            return VRMParser.chunkRebuilding()
                .then(() => {
                    resolve()
                })
                .catch(e => {
                    console.error('error', e)
                })
        })
    }

    public static createVRMFile = (): Promise<File> => {
        /* Header 12-byte
        uint32 magic
        uint32 version
        uint32 length
        */
        /* jsonChunk json
        uint32 chunkLength
        uint32 chunkType
        ubyte[] chunkData
        */
        /* binaryChunk bin
        uint32 chunkLength
        uint32 chunkType
        ubyte[] chunkData
        */
        console.log('jsonChunk', VRMParser.jsonChunk)
        console.log('binaryChunk', VRMParser.binaryChunk)

        return new Promise((resolve, reject) => {
            const data = new ArrayBuffer(
                VRMParser.CHUNK_HEADER_SIZE
                + VRMParser.CHUNK_LENGTH_SIZE
                + VRMParser.CHUNK_TYPE_SIZE
                + VRMParser.jsonChunk.chunkLength
                + VRMParser.CHUNK_LENGTH_SIZE
                + VRMParser.CHUNK_TYPE_SIZE
                + VRMParser.binaryChunk.chunkLength)

            const uint8 = new Uint8Array(data)
            const view = new DataView(data);
            let offset = 0
            view.setUint32(0, VRMParser.header.magic, VRMParser.IS_LITTLE_ENDIAN)
            view.setUint32(4, VRMParser.header.version, VRMParser.IS_LITTLE_ENDIAN)
            view.setUint32(8, VRMParser.header.length, VRMParser.IS_LITTLE_ENDIAN)
            offset += VRMParser.CHUNK_HEADER_SIZE
            view.setUint32(offset, VRMParser.jsonChunk.chunkLength, VRMParser.IS_LITTLE_ENDIAN)
            offset += VRMParser.CHUNK_LENGTH_SIZE
            view.setUint32(offset, VRMParser.CHUNK_TYPE_JSON, VRMParser.IS_LITTLE_ENDIAN)
            offset += VRMParser.CHUNK_TYPE_SIZE
            uint8.set(VRMParser.jsonChunk.chunkData, offset)

            offset += VRMParser.jsonChunk.chunkLength
            view.setUint32(offset, VRMParser.binaryChunk.chunkLength, VRMParser.IS_LITTLE_ENDIAN)
            offset += VRMParser.CHUNK_LENGTH_SIZE
            view.setUint32(offset, VRMParser.CHUNK_TYPE_BIN, VRMParser.IS_LITTLE_ENDIAN)
            offset += VRMParser.CHUNK_TYPE_SIZE
            uint8.set(VRMParser.binaryChunk.chunkData, offset)

            resolve(new File([data], VRMParser.filename!))
        })
    }

    // ダウンロードしてみる
    private static downloadBlob(file: File) {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(file)
        link.download = file.name
        link.click()
    }

    // TODO 頭にアクセサリを追加してみる
    public static addHeadAccessory = (): Promise<void> => {
        console.log('addAccessory')
        return new Promise((resolve, reject) => {
            // json を 編集する
            // meshes に Accessory meshe 情報を追加
            // nodes に Accessory meshe を追加 
            // nodes -> Head の children に Accessory meshe の インデックス追加

            resolve()
        })
    }

    // スプリングボーン グループ を取得する
    public static getSecondaryAnimationBoneGroups = (): { boneGroups: any } => {
        const extVRM = VRMParser.json.extensions.VRM
        console.log('extVRM', extVRM)
        console.log('secondaryAnimation', extVRM.secondaryAnimation)
        return extVRM.secondaryAnimation.boneGroups
    }

    // スプリングボーンを更新
    public static setSecondaryAnimationBoneGroups = (boneGroups: any): Promise<void> => {
        return new Promise((resolve, reject) => {
            const extVRM = VRMParser.json.extensions.VRM
            extVRM.secondaryAnimation.boneGroups = boneGroups

            return VRMParser.chunkRebuilding()
                .then(() => {
                    resolve()
                })
                .catch(e => {
                    console.error('error', e)
                })
        })
    }

    // スケールを設定する
    public static setScale = (scale: any): Promise<void> => {
        return new Promise((resolve, reject) => {
            // VRMParser.json.nodes から name が Armature を探す
            VRMParser.json.nodes.forEach((node: any) => {
                const name = node.name.toLowerCase()
                if (name === 'amature') {
                    // name Armature に scale がない場合がある
                    if (!node.scale) {
                        node.scale = [1.0, 1.0, 1.0]
                    }
                    node.scale[0] = scale[0]
                    node.scale[1] = scale[1]
                    node.scale[2] = scale[2]
                }
            })
            console.log('setScale scale', VRMParser.json.nodes[0].scale)

            return VRMParser.chunkRebuilding()
                .then(() => {
                    resolve()
                })
                .catch(e => {
                    console.error('error', e)
                })
        })
    }
}

export default VRMParser;