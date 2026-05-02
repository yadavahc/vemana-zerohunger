// A helper class to build Exotel IVR responses (XML)
export class ExotelIvrResponse {
  private response: any[] = [];
  public searchParams: URLSearchParams;

  constructor() {
    this.searchParams = new URLSearchParams();
  }

  private addToResponse(verb: string, attributes: object, nested?: any[]) {
    const element: any = { verb, attributes };
    if (nested) {
      element.nested = nested;
    }
    this.response.push(element);
  }

  say(text: string, attributes: object = {}) {
    this.addToResponse("Say", { ...attributes, content: text });
    return this;
  }

  play(url: string, attributes: object = {}) {
    this.addToResponse("Play", { ...attributes, content: url });
    return this;
  }

  gather(attributes: object) {
    const gatherNode = { verb: "Gather", attributes, nested: [] as any[] };
    this.response.push(gatherNode);

    return {
      say: (text: string, sayAttributes: object = {}) => {
        gatherNode.nested.push({ verb: "Say", attributes: { ...sayAttributes, content: text } });
        return this;
      },
      play: (url: string, playAttributes: object = {}) => {
        gatherNode.nested.push({ verb: "Play", attributes: { ...playAttributes, content: url } });
        return this;
      },
    };
}


  record(attributes: object) {
    this.addToResponse("Record", attributes);
    return this;
  }

  hangup() {
    this.addToResponse("Hangup", {});
    return this;
  }

  // This method converts the JSON-like structure to Exotel's required XML format
  private toXml(): string {
    const generateXml = (nodes: any[]): string => {
      return nodes.map(node => {
        const attributes = Object.entries(node.attributes)
          .map(([key, value]) => `${key}="${value}"`)
          .join(" ");
        if (node.nested && node.nested.length > 0) {
          return `<${node.verb} ${attributes}>${generateXml(node.nested)}</${node.verb}>`;
        }
        if (node.verb === 'Say' || node.verb === 'Play') {
            return `<${node.verb} ${attributes}>${node.attributes.content}</${node.verb}>`;
        }
        return `<${node.verb} ${attributes}/>`;
      }).join("");
    };

    return `<?xml version="1.0" encoding="UTF-8"?><Response>${generateXml(this.response)}</Response>`;
  }

  send() {
    const xml = this.toXml();
    console.log("[IVR] Sending XML Response:", xml);
    return new Response(xml, {
      headers: { "Content-Type": "application/xml" },
    });
  }
}
