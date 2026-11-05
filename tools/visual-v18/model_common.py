"""Blender 4.5 asset authoring helpers. Inputs use game X/right Y/up Z/front, metres.
Original meshes/materials authored for LIFE//LEVEL V18, no external model license.
"""
import bpy, math, json, os, random
from mathutils import Vector
import numpy as np

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '..','..'))
def xyz(p): return (p[0],-p[2],p[1])
def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def material(name, color, roughness=.55, metallic=0, texture=None, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness; p.inputs['Metallic'].default_value=metallic
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    if texture:
        n=512; yy,xx=np.mgrid[0:n,0:n]; rng=np.random.default_rng(81)
        if texture=='fabric':
            wave=.035*np.sin(xx*math.pi)+.025*np.cos(yy*math.pi)+.035*rng.random((n,n))
            weave=(np.sin(xx*math.pi/2)*np.cos(yy*math.pi/2))*.055
            val=np.clip(1+wave+weave,.83,1.17)
        else:
            wave=.075*np.sin(xx*.11+np.sin(yy*.015)*2)+.045*np.sin(xx*.31+np.sin(yy*.026))
            val=np.clip(1+wave+rng.random((n,n))*.025,.7,1.2)
        arr=np.ones((n,n,4),np.float32)
        for k in range(3): arr[:,:,k]=np.clip(color[k]*val,0,1)
        im=bpy.data.images.new(name+'-basecolor',width=n,height=n); im.pixels.foreach_set(arr.ravel()); im.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=im
        m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
        # Tangent-space micro normal survives glTF (unlike a Blender Noise/Bump graph).
        normal=np.ones((n,n,4),np.float32); normal[:,:,0]=.5+np.sin(xx*math.pi/2)*.09; normal[:,:,1]=.5+np.cos(yy*math.pi/2)*.09; normal[:,:,2]=.985
        imn=bpy.data.images.new(name+'-normal',width=n,height=n); imn.colorspace_settings.name='Non-Color'; imn.pixels.foreach_set(normal.ravel()); imn.pack()
        nt=m.node_tree.nodes.new('ShaderNodeTexImage'); nt.image=imn
        nm=m.node_tree.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.12 if texture=='fabric' else .15
        m.node_tree.links.new(nt.outputs['Color'],nm.inputs['Color']); m.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    return m

def apply_material(o,m):
    o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth=True
    return o

def box(name, loc, dims, mat, bevel=.025, segments=4):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(loc)); o=bpy.context.object; o.name=name
    o.dimensions=(dims[0],dims[2],dims[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Manufactured edge radius','BEVEL'); mod.width=bevel; mod.segments=segments
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    apply_material(o,mat)
    mod=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def tube(name, points, radius, mat, cyclic=False):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=2; c.bevel_depth=radius; c.bevel_resolution=2
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for p,co in zip(s.points,points): p.co=(*xyz(co),1)
    s.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); c.materials.append(mat)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return o

def cyl(name,loc,radius,depth,mat,vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=xyz(loc)); o=bpy.context.object; o.name=name
    bevel=o.modifiers.new('Turned edge','BEVEL'); bevel.width=min(.008,depth/8); bevel.segments=3; bpy.ops.object.modifier_apply(modifier=bevel.name)
    return apply_material(o,mat)

def sphere(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=xyz(loc)); o=bpy.context.object; o.name=name; o.scale=(scale[0],scale[2],scale[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return apply_material(o,mat)

def soft(name,loc,dims,mat,roundness=.10,wrinkle=.009,rot=0):
    # Subdivided, sculpted cushion: inflation, compressed corners and sewn-edge puckering.
    o=box(name,loc,dims,mat,min(roundness,min(dims)*.42),5)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    mod=o.modifiers.new('Upholstery subdivision','SUBSURF'); mod.levels=2; mod.render_levels=2; bpy.ops.object.modifier_apply(modifier=mod.name)
    for v in o.data.vertices:
        x,y,z=v.co; nx=x/(dims[0]/2); ny=y/(dims[2]/2); nz=z/(dims[1]/2)
        edge=max(abs(nx),abs(ny))
        if abs(nz)>.25:
            v.co.z += wrinkle*(math.sin(nx*19+ny*3)+.5*math.sin(ny*25+nx*5))*edge**5*(1 if z>0 else -1)
            v.co.z += dims[1]*.07*(1-nx*nx)*(1-ny*ny)*(1 if z>0 else -1)
    o.rotation_euler[2]=rot
    return o

def rounded_rect(cx,cy,cz,w,d,r=.06,n=8):
    pts=[]
    for ox,oz,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for i in range(n+1):
            t=math.radians(a+i*90/n); pts.append((cx+ox+r*math.cos(t),cy,cz+oz+r*math.sin(t)))
    return pts

def cloth(name,center,width,depth,top,mat,hang=.26,fold=.024,phase=0):
    # A tailored drape with continuous curled hems, undulating ridges and side fall.
    nx,nz=80,66; verts=[]; uv=[]; faces=[]
    for j in range(nz+1):
        v=j/nz; z=center[1]+(v-.5)*depth
        for i in range(nx+1):
            u=i/nx; x=center[0]+(u-.5)*width
            side=max(0,(abs(u-.5)-.405)/.095)
            foot=max(0,(v-.86)/.14)
            y=top-hang*(side**.55)-hang*.75*(foot**.65)
            y+=fold*(math.sin(u*26+v*7+phase)+.38*math.sin(u*53-v*5)+.18*math.cos(v*31+u*9))
            y+=fold*1.7*math.sin(v*math.pi)**2*math.sin(u*7+phase)
            verts.append(xyz((x,y,z))); uv.append((u*2,v*2))
    for j in range(nz):
        for i in range(nx):
            a=j*(nx+1)+i; faces.append((a,a+nx+1,a+nx+2,a+1))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); apply_material(o,mat)
    layer=mesh.uv_layers.new(name='Tailored fabric UV')
    for p in mesh.polygons:
        for li in p.loop_indices: layer.data[li].uv=uv[mesh.loops[li].vertex_index]
    solid=o.modifiers.new('Woven fabric thickness','SOLIDIFY'); solid.thickness=.009
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=solid.name)
    return o

def export_asset(category,slug,description,features):
    out=os.path.join(ROOT,'assets','apartment',category); runtime=os.path.join(ROOT,'public','assets','apartment',category)
    os.makedirs(out,exist_ok=True); os.makedirs(runtime,exist_ok=True)
    models=[o for o in bpy.context.scene.objects if o.type=='MESH']
    coords=[o.matrix_world @ Vector(c) for o in models for c in o.bound_box]
    low=[min(c[i] for c in coords) for i in range(3)]; high=[max(c[i] for c in coords) for i in range(3)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in models:o.select_set(True)
    glb=os.path.join(runtime,slug+'.glb')
    bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_image_format='AUTO',export_cameras=False,export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,slug+'.blend'))
    meta={'id':slug,'status':'ASSET PRODUCTION','description':description,'units':'metres','axes':'X right, Y up, Z front; feet at Y=0','dimensions':[round(high[0]-low[0],3),round(high[2]-low[2],3),round(high[1]-low[1],3)],'bounds':{'min':[round(low[0],3),round(low[2],3),round(-high[1],3)],'max':[round(high[0],3),round(high[2],3),round(-low[1],3)]},'meshCount':len(models),'triangles':sum(len(o.data.loop_triangles) or sum(len(p.vertices)-2 for p in o.data.polygons) for o in models),'features':features,'runtime':'/assets/apartment/'+category+'/'+slug+'.glb','license':'Original procedural mesh and texture authorship for this project; no third-party model inputs','reference':'REF-D; authored approximation, requires in-game visual gate'}
    with open(os.path.join(out,'metadata.json'),'w') as f:json.dump(meta,f,indent=2)
    return out

def preview(out,loc=(4.6,3.8,5.5),target=(0,.7,0),ortho=5):
    floor=material('Studio charcoal',(.055,.06,.075),.7)
    box('Preview ground',(0,-.04,0),(200,.08,200),floor,0)
    world=bpy.context.scene.world or bpy.data.worlds.new('Studio environment'); bpy.context.scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.15,.21,1); world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for name,power,color,position,size in [('Warm softbox',850,(1,.77,.56),(-3,5,2),4),('Cool fill',650,(.65,.75,1),(4,3,-1),3),('Rim',700,(1,.57,.28),(0,4,-3),2)]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=size
        o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.location=xyz(position); o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=xyz(loc)); c=bpy.context.object; c.rotation_euler=(Vector(xyz(target))-c.location).to_track_quat('-Z','Y').to_euler(); c.data.type='ORTHO'; c.data.ortho_scale=ortho; bpy.context.scene.camera=c
    s=bpy.context.scene; s.render.engine='CYCLES'; s.cycles.samples=48; s.cycles.use_denoising=True; s.render.resolution_x=1200; s.render.resolution_y=1000; s.render.resolution_percentage=100; s.render.image_settings.file_format='PNG'; s.render.filepath=os.path.join(out,'preview.png'); s.view_settings.view_transform='AgX'; s.render.film_transparent=False
    bpy.ops.render.render(write_still=True)
