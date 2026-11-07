import Foundation

extension JSONDecoder {
    static let gateway: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()
}

extension JSONEncoder {
    static let gateway: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.withoutEscapingSlashes]
        return e
    }()
}