import Image from '@tiptap/extension-image';

export const PostImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      height: { default: null },
    };
  },
}).configure({ inline: false, allowBase64: false });